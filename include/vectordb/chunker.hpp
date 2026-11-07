#pragma once

#include <cstddef>
#include <string>
#include <vector>

namespace vectordb {

/// Represents a single text chunk produced by the chunker.
struct Chunk {
    std::size_t index = 0;       ///< 0-based consecutive chunk index
    std::size_t startByte = 0;   ///< Start byte offset in original text (inclusive)
    std::size_t endByte = 0;     ///< End byte offset in original text (exclusive)
    std::string text;            ///< Trimmed chunk text
};

/// Strategy used for chunking documents.
enum class ChunkStrategy {
    Fixed,
    Sentence
};

/// Convert ChunkStrategy to lowercase string ("fixed" or "sentence").
std::string chunkStrategyToString(ChunkStrategy strategy);

/// Parse ChunkStrategy from string ("fixed" or "sentence", case-insensitive). Throws std::invalid_argument if unknown.
ChunkStrategy chunkStrategyFromString(const std::string& str);

/// Configuration options for document chunking.
struct ChunkOptions {
    ChunkStrategy strategy = ChunkStrategy::Sentence;
    std::size_t maxChars = 800;       ///< Maximum window size in bytes (must be >= 100)
    std::size_t overlapChars = 100;   ///< Overlap size in bytes (must be < maxChars / 2)
};

/**
 * @brief Splits an input text into UTF-8 safe chunks.
 *
 * Rules:
 * - Window sizes and overlaps are measured in BYTES, but every cut point is moved
 *   to a UTF-8 character boundary so that multi-byte code points (e.g. Hindi, emojis,
 *   accented characters) are never severed.
 * - Fixed: Windows of maxChars with overlapChars overlap; prefers cutting at whitespace
 *   within the last 15% of the window; otherwise cuts at the nearest UTF-8 character boundary.
 * - Sentence: Splits at sentence terminators (. ! ?) followed by whitespace or EOF, at the
 *   Devanagari danda (U+0964), and at blank lines (paragraph breaks). Greedily packs whole
 *   sentences up to maxChars; carries the trailing sentence(s) totalling at most overlapChars
 *   into the next chunk; a single sentence exceeding maxChars is hard-split like Fixed.
 * - Each chunk's text is trimmed of leading and trailing whitespace; empty or whitespace-only
 *   chunks are dropped.
 * - Returns an empty vector if input text is empty or purely whitespace.
 * - Deterministic: identical inputs produce identical outputs.
 *
 * @throws std::invalid_argument if maxChars < 100 or overlapChars >= maxChars / 2.
 */
std::vector<Chunk> chunkText(const std::string& text, const ChunkOptions& opt);

} // namespace vectordb
