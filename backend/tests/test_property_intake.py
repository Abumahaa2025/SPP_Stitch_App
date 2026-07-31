"""Tests for property statement intake engine."""

from adapters.upload_analysis.portfolio_engine import analyze_upload_portfolio
from beta_seed import beta_dataset


def test_filenames_without_content_no_synthetic():
    """Filenames alone must not produce fake tenant data."""
    files = [
        {"name": "كشف_إيجار_شهر_1_2026.xlsx"},
        {"name": "كشف_إيجار_شهر_2_2026.xlsx"},
    ]
    ctx = beta_dataset("owner")
    out = analyze_upload_portfolio(files, ctx, lang="ar")
    assert out["intake_meta"]["synthetic_fallback"] is False
    assert out["metrics"]["months_linked"] == 0


def test_multi_month_csv_snippets_lifecycle():
    csv1 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد,5000,مسدد\n102,سعد,4500,مسدد\n"
    csv2 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد,5000,مسدد\n102,نورة,4500,مسدد\n"
    files = [
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": csv1},
        {"name": "كشف_شهر_2_2026.csv", "textSnippet": csv2},
    ]
    ctx = beta_dataset("owner")
    out = analyze_upload_portfolio(files, ctx, lang="ar")
    assert out["metrics"]["months_linked"] >= 2
    sections = {s["key"]: s for s in out["executive_report"]["sections"]}
    assert "departed" in sections
    assert out["intake_meta"]["synthetic_fallback"] is False


def test_csv_snippet_parsed():
    csv = "وحدة,مستأجر,إيجار,حالة\n101,أحمد,5000,مسدد\n102,سعد,4500,متأخر\n"
    files = [{"name": "كشف_شهر_3.csv", "textSnippet": csv}]
    ctx = beta_dataset("owner")
    out = analyze_upload_portfolio(files, ctx, lang="ar")
    assert out["metrics"]["files_analyzed"] == 1
    assert out["executive_report"]["sections"]
