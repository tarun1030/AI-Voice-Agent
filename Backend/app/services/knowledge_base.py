# knowledge_base.py  —  drop-in replacement
import os
import logging
import json
import faiss
import numpy as np
import re
from typing import List, Dict, Tuple
from datetime import datetime
from sentence_transformers import SentenceTransformer
from pypdf import PdfReader
from docx import Document as DocxDocument

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ---------------------------------------------------------------------------
# Semantic / Structure-Aware Text Splitter
# ---------------------------------------------------------------------------

class SemanticTextSplitter:
    """
    Splits text respecting natural document structure:
      1. Rejoins PDF hyphenated line-breaks  (e.g. "docu-\nmentation" -> "documentation")
      2. Splits at paragraph/section boundaries first, then sentence endings
      3. Packs whole sentences into chunks; overlap is whole sentences too
    """

    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 80):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> List[str]:
        text = self._clean_text(text)
        sentences = self._split_into_sentences(text)
        return self._pack_sentences(sentences)

    # --- Step 1: clean PDF noise -------------------------------------------

    def _clean_text(self, text: str) -> str:
        # Rejoin hyphenated line-breaks (PDF artefact: "docu-\n mentation")
        text = re.sub(r"-\n\s*", "", text)
        # Collapse excessive blank lines
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = text.replace("\r", "").replace("\f", "\n\n")
        return text.strip()

    # --- Step 2: sentence tokenisation (no NLTK needed) --------------------

    def _split_into_sentences(self, text: str) -> List[str]:
        paragraphs = re.split(r"\n\s*\n", text)
        sentences: List[str] = []
        sentence_end = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"'\(])")
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            for part in sentence_end.split(para):
                part = part.strip()
                if part:
                    sentences.append(part)
        return sentences

    # --- Step 3: pack whole sentences into chunks --------------------------

    def _pack_sentences(self, sentences: List[str]) -> List[str]:
        chunks: List[str] = []
        current_parts: List[str] = []
        current_len = 0

        for sent in sentences:
            sent_len = len(sent)

            if sent_len > self.chunk_size:          # single monster sentence
                if current_parts:
                    chunks.append(" ".join(current_parts))
                    current_parts, current_len = [], 0
                chunks.extend(self._hard_split(sent))
                continue

            if current_len + sent_len + 1 > self.chunk_size and current_parts:
                chunks.append(" ".join(current_parts))
                overlap_parts = self._build_overlap(current_parts)
                current_parts = overlap_parts
                current_len = sum(len(s) for s in current_parts)

            current_parts.append(sent)
            current_len += sent_len + 1

        if current_parts:
            chunks.append(" ".join(current_parts))

        return [c.strip() for c in chunks if c.strip()]

    def _build_overlap(self, parts: List[str]) -> List[str]:
        overlap: List[str] = []
        total = 0
        for sent in reversed(parts):
            if total + len(sent) + 1 > self.chunk_overlap:
                break
            overlap.insert(0, sent)
            total += len(sent) + 1
        return overlap

    def _hard_split(self, text: str) -> List[str]:
        return [
            text[i: i + self.chunk_size]
            for i in range(0, len(text), self.chunk_size - self.chunk_overlap)
        ]


# ---------------------------------------------------------------------------
# Knowledge Base Service
# ---------------------------------------------------------------------------

class KnowledgeBaseService:
    """
    FAISS vector store with:
      - Cosine similarity (IndexFlatIP on L2-normalised embeddings)
      - Score threshold to discard irrelevant chunks
      - MMR deduplication for diverse, high-quality results
    """

    SCORE_THRESHOLD = 0.30   # cosine sim below this -> discard
    MMR_LAMBDA      = 0.7    # 1.0 = pure relevance, 0.0 = pure diversity

    def __init__(self):
        self.embedding_model = SentenceTransformer(settings.embedding_model)
        self.dimension = 384                        # all-MiniLM-L6-v2
        self.index = faiss.IndexFlatIP(self.dimension)   # cosine via normalised IP
        self.metadata: List[Dict] = []
        self.text_splitter = SemanticTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        self.index_path   = "data/faiss_index"
        self.metadata_path = "data/metadata.json"
        self._load_index()

    # --- persistence -------------------------------------------------------

    def _load_index(self):
        try:
            if os.path.exists(f"{self.index_path}.index"):
                self.index = faiss.read_index(f"{self.index_path}.index")
                logger.info("Loaded existing FAISS index")
            if os.path.exists(self.metadata_path):
                with open(self.metadata_path, "r") as f:
                    self.metadata = json.load(f)
                logger.info(f"Loaded {len(self.metadata)} metadata entries")
        except Exception as e:
            logger.error(f"Error loading index: {e}")

    def _save_index(self):
        try:
            os.makedirs("data", exist_ok=True)
            faiss.write_index(self.index, f"{self.index_path}.index")
            with open(self.metadata_path, "w") as f:
                json.dump(self.metadata, f)
            logger.info("Saved FAISS index and metadata")
        except Exception as e:
            logger.error(f"Error saving index: {e}")

    # --- helpers -----------------------------------------------------------

    def _extract_text(self, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            reader = PdfReader(file_path)
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        elif ext == ".docx":
            doc = DocxDocument(file_path)
            return "\n".join(p.text for p in doc.paragraphs)
        elif ext == ".txt":
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        raise ValueError(f"Unsupported file format: {ext}")

    def _embed(self, texts: List[str]) -> np.ndarray:
        """Encode + L2-normalise  ->  dot-product == cosine similarity."""
        vecs = self.embedding_model.encode(texts, show_progress_bar=False)
        arr  = np.array(vecs, dtype="float32")
        faiss.normalize_L2(arr)
        return arr

    def _get_vector(self, idx: int) -> np.ndarray:
        vec = np.zeros(self.dimension, dtype="float32")
        self.index.reconstruct(idx, vec)
        return vec

    # --- ingest ------------------------------------------------------------

    async def ingest_document(self, file_path: str, filename: str) -> Dict:
        try:
            text   = self._extract_text(file_path)
            chunks = self.text_splitter.split_text(text)
            doc_id = f"doc_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"

            embeddings = self._embed(chunks)
            self.index.add(embeddings)

            for i, chunk in enumerate(chunks):
                self.metadata.append({
                    "doc_id":      doc_id,
                    "filename":    filename,
                    "chunk_index": i,
                    "text":        chunk,
                    "created_at":  datetime.now().isoformat(),
                })

            self._save_index()
            logger.info(f"Ingested '{filename}' -> {len(chunks)} chunks")
            return {"doc_id": doc_id, "filename": filename, "chunks": len(chunks)}

        except Exception as e:
            logger.error(f"Error ingesting document: {e}")
            raise

    # --- retrieval ---------------------------------------------------------

    async def retrieve(self, query: str, top_k: int = 5) -> Dict:
        """
        1. Embed & normalise query
        2. FAISS IP search (= cosine sim)
        3. Filter by SCORE_THRESHOLD
        4. MMR deduplication
        5. Return top_k diverse, relevant chunks
        """
        try:
            if not self.metadata:
                return {"chunks": [], "sources": [], "scores": []}

            q_vec   = self._embed([query])
            fetch_k = min(top_k * 4, len(self.metadata))
            scores, indices = self.index.search(q_vec, fetch_k)
            scores, indices = scores[0], indices[0]

            candidates: List[Tuple[int, float]] = [
                (int(idx), float(score))
                for idx, score in zip(indices, scores)
                if idx < len(self.metadata) and float(score) >= self.SCORE_THRESHOLD
            ]

            if not candidates:          # relax threshold if nothing passes
                candidates = [
                    (int(idx), float(score))
                    for idx, score in zip(indices[:top_k], scores[:top_k])
                    if idx < len(self.metadata)
                ]

            selected = self._mmr_select(q_vec[0], candidates, top_k)

            chunks, sources, final_scores = [], [], []
            for idx, score in selected:
                meta = self.metadata[idx]
                chunks.append(meta["text"])
                sources.append(f"{meta['filename']} (chunk {meta['chunk_index']})")
                final_scores.append(round(score, 4))

            logger.info(f"Retrieved {len(chunks)} chunks | scores: {final_scores}")
            return {"chunks": chunks, "sources": sources, "scores": final_scores}

        except Exception as e:
            logger.error(f"Error retrieving chunks: {e}")
            return {"chunks": [], "sources": [], "scores": []}

    def _mmr_select(
        self,
        query_vec:  np.ndarray,
        candidates: List[Tuple[int, float]],
        k:          int,
    ) -> List[Tuple[int, float]]:
        """Maximal Marginal Relevance — relevance minus redundancy."""
        selected:  List[Tuple[int, float]] = []
        remaining = list(candidates)

        while remaining and len(selected) < k:
            if not selected:
                best = max(remaining, key=lambda x: x[1])
            else:
                sel_vecs   = np.array([self._get_vector(i) for i, _ in selected], dtype="float32")
                best_score = -np.inf
                best       = remaining[0]
                for idx, rel in remaining:
                    cand_vec         = self._get_vector(idx)
                    sim_to_selected  = float(np.max(sel_vecs @ cand_vec))
                    mmr              = self.MMR_LAMBDA * rel - (1 - self.MMR_LAMBDA) * sim_to_selected
                    if mmr > best_score:
                        best_score = mmr
                        best = (idx, rel)

            selected.append(best)
            remaining.remove(best)

        return selected

    # --- management --------------------------------------------------------

    async def list_documents(self) -> List[Dict]:
        docs_map: Dict[str, Dict] = {}
        for meta in self.metadata:
            d = meta["doc_id"]
            if d not in docs_map:
                docs_map[d] = {
                    "doc_id":     d,
                    "filename":   meta["filename"],
                    "chunks":     0,
                    "created_at": meta["created_at"],
                }
            docs_map[d]["chunks"] += 1
        return list(docs_map.values())

    async def delete_document(self, doc_id: str):
        try:
            keep = [i for i, m in enumerate(self.metadata) if m["doc_id"] != doc_id]
            if len(keep) == len(self.metadata):
                raise ValueError(f"Document {doc_id} not found")

            new_index = faiss.IndexFlatIP(self.dimension)
            new_meta  = []
            for idx in keep:
                vec = self._get_vector(idx)
                new_index.add(vec.reshape(1, -1))
                new_meta.append(self.metadata[idx])

            self.index    = new_index
            self.metadata = new_meta
            self._save_index()
            logger.info(f"Deleted document {doc_id}")
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            raise

    async def clear_all(self):
        try:
            self.index    = faiss.IndexFlatIP(self.dimension)
            self.metadata = []
            self._save_index()
            logger.info("Cleared all documents")
        except Exception as e:
            logger.error(f"Error clearing knowledge base: {e}")
            raise