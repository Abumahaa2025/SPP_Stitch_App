"""Arabic prompt templates for the LLM interpretation layer."""

from __future__ import annotations

import json
from typing import Any, Dict


def build_system_prompt(context: Dict[str, Any]) -> str:
    """Build the system prompt for the LLM.

    The system prompt:
    1. Defines the LLM's role (explainer, not calculator).
    2. Lists what the LLM must NEVER do.
    3. Provides the controlled context as JSON.
    4. Enforces Arabic output.
    5. Enforces gate-awareness (review language when blocked).
    """
    gate = context.get("normalized_gate") or {}
    gate_status = gate.get("status", "ok")

    rules = [
        "أنت مساعد ذكي يعمل داخل منصة SPP لإدارة العقارات.",
        "وظيفتك الوحيدة هي شرح وتوضيح النتائج المُتحقّق منها من بيانات الاستيراد.",
        "",
        "الممنوعات (لا تقم بها أبداً):",
        "- لا تحسب أي إجماليات مالية أو معدلات تحصيل أو نسب إشغال.",
        "- لا تخترع أسماء مستأجرين أو وحدات أو عقود أو دفعات غير موجودة في السياق.",
        "- لا تنشئ أحداث دورة حياة جديدة.",
        "- لا تتجاوز بوابة الاتساق أو تغيّر درجات القرارات.",
        "- لا تدّعي تنفيذ أي إجراء.",
        "- لا تصل إلى الملفات المرفوعة الأصلية.",
        "",
        "المسموحات:",
        "- اشرح النتائج المُتحقّق منها بلغة عربية تنفيذية واضحة.",
        "- لخّص الذكاء التشغيلي من البيانات المُقدّمة.",
        "- أجب على أسئلة المستخدم بناءً على السياق المُقدّم فقط.",
        "- قدّم التوصيات المعتمدة مع التحفظ اللازم.",
        "- استخدم أرقام القرارات (decision IDs) عند الإشارة إلى توصية محددة.",
        "",
        "قواعد بوابة الاتساق:",
    ]

    if gate_status == "blocked_for_review":
        rules.extend([
            "- بوابة الاتساق محظورة حالياً. لا تقدّم أي ادعاءات نهائية.",
            "- استخدم لغة المراجعة: «توجد مؤشرات تحتاج مراجعة» بدلاً من تأكيد المغادرة أو المتأخرات.",
            "- لا توصِ بأي إجراء تنفيذي (تحصيل، إخلاء، صيانة) حتى تُحل التعارضات.",
            "- اذكر رموز التعارضات عند الحاجة.",
        ])
    elif gate_status == "warning":
        rules.extend([
            "- توجد تحذيرات في بوابة الاتساق. استخدم لغة متحفظة عند مناقشة البيانات المتأثرة.",
        ])
    else:
        rules.extend([
            "- بوابة الاتساق سليمة. يمكنك تقديم النتائج بثقة مع التحفظ اللازم.",
        ])

    rules.extend([
        "",
        "السياق المُتحقّق منه (JSON):",
        "```json",
        json.dumps(context, ensure_ascii=False, indent=2, default=str),
        "```",
    ])

    return "\n".join(rules)


def build_user_prompt(task: str, question: str | None, context: Dict[str, Any]) -> str:
    """Build the user prompt for the LLM based on the task type."""
    if task == "executive_summary":
        return (
            "قدّم ملخصاً تنفيذياً مختصراً (3-5 أسطر) باللغة العربية يتضمن:\n"
            "1. أهم ما حدث في الاستيراد.\n"
            "2. المخاطر الرئيسية.\n"
            "3. الإجراءات الموصى بها.\n"
            "استخدم فقط البيانات من السياق المُقدّم."
        )
    elif task == "decision_explanation":
        decisions = context.get("unified_smart_decisions") or []
        if not decisions:
            return "لا توجد قرارات متاحة للشرح."
        top = decisions[0]
        return (
            f"اشرح القرار التالي باللغة العربية:\n"
            f"رقم القرار: {top.get('id', '—')}\n"
            f"النوع: {top.get('kind', '—')}\n"
            f"الأولوية: {top.get('priority', '—')}\n"
            f"العنوان: {top.get('title', '—')}\n"
            f"الإجراء: {top.get('action', '—')}\n"
            f"الثقة: {top.get('confidence', 0)}\n"
            f"يتطلب تأكيد: {top.get('requires_confirmation', True)}\n"
            f"محظور بالبوابة: {top.get('blocked_by_gate', False)}\n\n"
            "اشرح سبب هذا القرار وما يجب على المالك فعله."
        )
    else:  # answer
        q = question or "ما هي أهم الملاحظات من آخر استيراد؟"
        return f"السؤال: {q}\n\nأجب باللغة العربية بناءً على السياق المُقدّم فقط."
