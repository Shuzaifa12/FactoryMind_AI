import numpy as np
import pandas as pd

from app.services.anomaly_detector import compute_mad, run_isolation_forest


def test_compute_mad():
    # Symmetric data
    data = pd.Series([10.0, 10.0, 10.0, 12.0, 14.0, 10.0, 10.0])
    mad = compute_mad(data)
    assert mad >= 0.0

    # Constant data returns non-zero fallback (1.0)
    const_data = pd.Series([5.0, 5.0, 5.0, 5.0])
    mad_const = compute_mad(const_data)
    assert mad_const == 1.0


def test_run_isolation_forest_with_anomaly():
    # 50 normal points around 10.0 and 3 extreme outliers at 50.0
    np.random.seed(42)
    normal = np.random.normal(10.0, 0.5, size=(50, 2))
    outliers = np.array([[50.0, 50.0], [52.0, 48.0], [49.0, 51.0]])
    data = np.vstack([normal, outliers])
    df = pd.DataFrame(data, columns=["feature_1", "feature_2"])

    is_anomaly, norm_scores = run_isolation_forest(df, contamination=0.06)

    # Output dimensions
    assert len(is_anomaly) == 53
    assert len(norm_scores) == 53

    # Anomaly scores should be between 0.0 and 1.0
    assert (norm_scores >= 0.0).all()
    assert (norm_scores <= 1.0).all()

    # The 3 outliers at the end should have higher scores than typical normal points
    assert norm_scores[-1] > norm_scores[0]
    assert is_anomaly[-1] == True
