"""Unit tests for GAS → PropertyT mapping (no Mongo / network)."""

from adapters.mappers.properties import map_properties_from_app_data


def test_map_properties_from_units():
    app_data = {
        "settings": {"propertyName": "مجمع النخبة", "clientName": "أحمد"},
        "propertyHealth": {"score": 84},
        "dashboard": {
            "summary": {"totalUnits": 2, "rented": 1, "totalRent": 15000},
            "units": [
                {
                    "unit": "وحدة 3",
                    "tenant": "خالد العتيبي",
                    "rent": 12500,
                    "payStatus": "متأخر",
                    "contractStatusResolved": "نشط",
                },
                {
                    "unit": "وحدة 7",
                    "tenant": "",
                    "rent": 8000,
                    "payStatus": "مدفوع",
                    "contractStatusResolved": "شاغرة",
                },
            ],
        },
    }

    props = map_properties_from_app_data(app_data)
    assert len(props) == 2
    assert props[0]["name"] == "وحدة 3"
    assert props[0]["monthly_revenue"] == 12500
    assert props[0]["occupancy"] == 1.0
    assert props[0]["address"] == "مجمع النخبة"
    assert "id" in props[0] and props[0]["id"].startswith("prop_")
    assert props[1]["occupancy"] == 0.0
    assert 0 <= props[0]["health_score"] <= 100


def test_map_properties_empty_units_uses_summary():
    app_data = {
        "settings": {"propertyName": "برج الأعمال"},
        "propertyHealth": {"score": 90},
        "dashboard": {
            "summary": {"totalUnits": 8, "rented": 6, "totalRent": 96000},
            "units": [],
        },
    }
    props = map_properties_from_app_data(app_data)
    assert len(props) == 1
    assert props[0]["name"] == "برج الأعمال"
    assert props[0]["units"] == 8
    assert props[0]["occupancy"] == 0.75
