"""Tests for Koil AI Understanding layer (Layer 2)."""

from adapters.koil.understanding_engine import run_koil_understanding
from adapters.upload_analysis.portfolio_engine import analyze_upload_portfolio
from beta_seed import beta_dataset


def test_understanding_on_csv_snippets():
    csv1 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد,5000,مسدد\n102,محل-1,4500,مسدد\n"
    csv2 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد,5000,مسدد\n102,نورة,4500,متأخر\n"
    files = [
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": csv1},
        {"name": "كشف_شهر_2_2026.csv", "textSnippet": csv2},
    ]
    ctx = beta_dataset("owner")
    out = analyze_upload_portfolio(files, ctx, lang="ar")

    understanding = out.get("koil_understanding") or {}
    assert understanding.get("version") == "koil-understanding-v1"
    assert understanding.get("portfolio_summary")
    assert len(understanding.get("files") or []) >= 2

    section_keys = [s["key"] for s in out["executive_report"]["sections"]]
    assert "koil_understanding_summary" in section_keys
    assert section_keys.index("koil_understanding_summary") < section_keys.index("koil_brief")


def test_understanding_rules_mode_without_llm():
    deep = {
        "file_classifications": [
            {"name": "كشف شهر 1.csv", "category": "rent_roll", "confidence": 80, "month": 1, "year": 2026},
        ],
        "parsed_rolls": [
            {
                "ok": True,
                "file_name": "كشف شهر 1.csv",
                "month": 1,
                "year": 2026,
                "row_count": 2,
                "column_confidence": 85,
                "column_labels": {"unit": "وحدة", "tenant": "مستأجر"},
                "rows": [{"unit": "101", "tenant": "أحمد", "unit_type": "شقة"}],
            }
        ],
        "parse_errors": [],
        "files_without_content": [],
    }
    result = run_koil_understanding([{"name": "كشف شهر 1.csv"}], deep, lang="ar")
    assert result["mode"] == "rules"
    assert result["confidence"] > 0
    assert result["files"][0]["understood_as"]
