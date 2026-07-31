"""Executive agenda — daily work queue by impact tier."""

from __future__ import annotations

from typing import Dict, List

from adapters.executive.ranking import agenda_caps, attach_tier_emoji


def build_executive_agenda(
    ranked_items: List[dict],
    opportunities: List[dict],
    unit_count: int,
) -> Dict[str, List[dict]]:
    caps = agenda_caps(unit_count)
    buckets: Dict[str, List[dict]] = {
        "now": [],
        "today": [],
        "week": [],
        "follow_up": [],
    }

    for item in ranked_items:
        tier = item.get("tier", "follow_up")
        if tier not in buckets:
            tier = "follow_up"
        if len(buckets[tier]) < caps[tier]:
            buckets[tier].append(attach_tier_emoji(item))

    # Surface top opportunities in week/today if room
    for opp in opportunities:
        opp_item = attach_tier_emoji(
            {
                **opp,
                "source": "opportunity",
                "tier": "week" if opp.get("score", 0) < 60 else "today",
                "priority": "medium",
            }
        )
        tier = opp_item["tier"]
        if len(buckets[tier]) < caps[tier]:
            buckets[tier].append(opp_item)

    return {
        "now": buckets["now"],
        "today": buckets["today"],
        "this_week": buckets["week"],
        "follow_up": buckets["follow_up"],
        "labels": {
            "now": "يجب تنفيذها الآن",
            "today": "اليوم",
            "this_week": "هذا الأسبوع",
            "follow_up": "متابعة فقط",
        },
    }
