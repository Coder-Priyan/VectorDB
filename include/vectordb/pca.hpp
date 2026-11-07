#pragma once

#include <cstddef>
#include <vector>

namespace vectordb {

/**
 * @brief Results of Principal Component Analysis.
 */
struct PcaResult {
    std::size_t dim = 0;                          ///< Original vector dimension
    std::size_t components = 0;                   ///< Number of principal components retained
    std::vector<float> mean;                      ///< Mean vector of the dataset (size: dim)
    std::vector<std::vector<float>> axes;         ///< Principal axes (components x dim), unit length, mutually orthogonal
    std::vector<double> variance;                 ///< Variance explained along each axis
    double totalVariance = 0.0;                   ///< Total dataset variance
    std::vector<double> explainedRatio;           ///< Fraction of variance explained along each axis (sum <= 1.0)
    bool normalized = false;                      ///< Whether input rows were L2-normalized prior to PCA
};

/**
 * @brief Computes PCA using power iteration with deflation in O(n * dim) per iteration.
 *
 * Why power iteration?
 * For dimension reduction to 2 components (e.g. 2D visualization), full eigendecomposition
 * or SVD is an overkill. Forming the dim x dim covariance matrix costs O(n * dim^2) time
 * and O(dim^2) memory, which is prohibitive for dim=768 or dim=1536.
 * Power iteration evaluates matrix-vector products as Xc^T * (Xc * v) / (n - 1) in O(n * dim)
 * time without ever instantiating the covariance matrix.
 *
 * What is explainedRatio?
 * explainedRatio[c] = variance[c] / totalVariance represents the fraction of total variance
 * captured by component c. In 2D projections, the sum of explained ratios indicates how faithfully
 * the 2D planar projection preserves the relative distances of the high-dimensional space.
 *
 * @param data Contiguous row-major array of floats of size n * dim
 * @param n Number of data points (rows)
 * @param dim Dimension of each data point (columns)
 * @param components Number of principal axes to compute (default: 2)
 * @param normalizeRows If true, each row is L2-normalized before computing mean and covariance
 * @param seed Random seed for deterministic initial vector generation
 * @param maxIter Maximum power iterations per component
 * @param tol Convergence tolerance on direction change
 *
 * @throws std::invalid_argument if dim < components
 */
PcaResult fitPca(const float* data,
                 std::size_t n,
                 std::size_t dim,
                 std::size_t components = 2,
                 bool normalizeRows = false,
                 unsigned seed = 42,
                 std::size_t maxIter = 200,
                 double tol = 1e-9);

/**
 * @brief Projects a high-dimensional vector onto the fitted PCA subspace.
 *
 * If pca.normalized is true, vec is L2-normalized prior to subtracting the mean.
 * If vec is a zero vector, it remains zero.
 *
 * @param pca The fitted PCA model
 * @param vec Pointer to a float array of size pca.dim
 * @return Projected coordinates vector of size pca.components
 */
std::vector<float> projectPca(const PcaResult& pca, const float* vec);

} // namespace vectordb

