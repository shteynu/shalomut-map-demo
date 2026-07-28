"""A small Hebrew topic lexicon shared by questions and catalog entries.

Round questionnaires are free text, so a recommendation can only be matched to
a question through the words both use. Comparing raw substrings does that
badly in Hebrew: `בעומס` never equals `עומס`, and a three-letter fragment
matches half the catalog. Here both sides are reduced to the same closed set
of topics, which keeps the comparison explainable — a reader can see why an
entry surfaced — and keeps the vocabulary in one place instead of spread over
120 catalog rows.
"""

from typing import Dict, Iterable, Set

# Prefixes a Hebrew word can pick up without changing its topic.
_PREFIXES = ("ו", "ה", "ב", "ל", "מ", "ש", "כ")
_MIN_STEM_LENGTH = 3

# A word may carry more than one topic; the ranking removes whatever every
# candidate shares, so an overlap costs nothing and a missing word costs a lot.
# The questionnaire (src/lib/shalomut-source.ts) speaks in the first person
# about feelings, while the catalog speaks in nouns about actions — both
# vocabularies have to be in here or half the questions carry no topic and the
# distribution has nothing to weight.
TOPIC_LEXICON: Dict[str, tuple[str, ...]] = {
    "workload": (
        "עומס", "עומסים", "שעות", "משימות", "מועדים", "תיעדוף", "מנהלה",
        "דיווח", "היערכות", "חופשות", "ניתוק", "זמן", "זמנים", "מבחנים",
        "להתמודד", "כשירה", "חלוקת",
    ),
    "voice": (
        "קול", "ביטוי", "הצעות", "שאלות", "נציגות", "ועדות", "יוזמה",
        "יוזמות", "שיתוף", "השתתפות", "דעה", "דעתי", "להביע", "רעיונות",
        "מחשבות", "חופשיות", "שומעים", "נשמעת", "מתחשבים",
    ),
    "management": (
        "הנהלה", "ניהולי", "ניהולית", "מנהלת", "מנהל", "גיבוי", "סמכות",
        "סמכויות", "מענה", "פניות", "לפנות", "עזרה", "זמינות", "נגישות",
        "משוב", "רכזים",
    ),
    "clarity": (
        "בהירות", "נהלים", "תפקיד", "תפקידים", "שיבוץ", "ודאות", "שינויים",
        "החלטות", "תיעוד", "סיכום", "לוח", "יציבות", "אחריות", "ברור",
        "ברורה", "בירור", "מוגדרות", "מצפה", "צפויים", "מתוכננים", "התראה",
    ),
    "relations": (
        "חברתי", "חברתיים", "עמיתים", "קשר", "קשרים", "לכידות", "ארוחות",
        "מפגש", "מפגשים", "הדדית", "הדדי", "בדידות", "שייכות", "צוותי",
        "צוות", "תמיכה", "תקשורת", "קולגות", "אנרגיה",
    ),
    "climate": (
        "אקלים", "שיח", "מכבד", "כבוד", "קונפליקט", "מתחים", "בריונות",
        "הוקרה", "פרגון", "הכרה", "אמון", "בטוח", "ביטחון", "אווירה",
        "לחץ", "רגשות", "רגשיים", "פסיכולוגיים", "קשיים", "פתוח",
    ),
    "growth": (
        "למידה", "מקצועי", "מקצועית", "פיתוח", "סדנה", "סדנאות", "הכשרה",
        "חונכות", "חניכה", "תצפית", "מומחיות", "מערכי", "הוראה", "פדגוגי",
        "יכולות", "מסוגלות",
    ),
    "meaning": (
        "משמעות", "תכלית", "מטרות", "ערכים", "השפעה", "הצלחה", "הצלחות",
        "התקדמות", "תלמידים", "מורשת", "טקס", "טקסים", "חינוכית", "תועלת",
        "אנשים", "חשובה",
    ),
    "onboarding": ("חדש", "חדשים", "קליטה", "חונך", "ותיקים"),
    "health": (
        "מחלה", "בריאות", "התאוששות", "שלומות", "גופנית", "חוסן", "שחיקה",
        "מנוחה", "נפשי", "נפשית",
    ),
    # Sub-dimension topics. Without them every candidate inside a dimension
    # matches the same broad topic and the ranking cannot tell them apart.
    "mentoring": ("חונכות", "חניכה", "חונך", "ליווי", "מלווה", "צמוד"),
    "classroom": ("כיתה", "כיתות", "משמעת", "תלמידים", "הוראה", "שיעור"),
    "resources": (
        "משאבים", "מאגר", "בנק", "מערכי", "טכנולוגית", "תקציב", "חומרים",
    ),
    "choice": ("בחירה", "דיפרנציאלי", "צורך", "צרכים", "גמישות", "מסלולי"),
    "feedback": ("משוב", "תצפית", "תצפיות", "הערכה", "סקר", "שאלון"),
    "schedule": (
        "מערכת", "שיבוץ", "מועדי", "מועדים", "לוח", "שעות", "יום", "זמן",
        "מחר", "הקרוב",
    ),
    "recognition": (
        "הוקרה", "פרגון", "הכרה", "מעריכ", "מעריכה", "מוערכת", "ערך",
        "חיזוק", "מאמצים", "כישורים", "מתחשבים", "גלוי", "תודה",
    ),
    "authenticity": (
        "עצמי", "עצמה", "אותנטיות", "פנים", "להעמיד", "כנות", "אמיתית",
    ),
    "trust": (
        "אמון", "סומכת", "סומך", "פתיחות", "פתוח", "חשש", "דיסקרטיות",
    ),
}

_TOPIC_BY_WORD: Dict[str, Set[str]] = {}
for _topic, _words in TOPIC_LEXICON.items():
    for _word in _words:
        _TOPIC_BY_WORD.setdefault(_word, set()).add(_topic)


def _word_forms(word: str) -> Iterable[str]:
    """The word itself and what it looks like without Hebrew prefixes."""
    yield word
    for length in (1, 2):
        if len(word) - length < _MIN_STEM_LENGTH:
            continue
        if all(character in _PREFIXES for character in word[:length]):
            yield word[length:]


def topics_for_text(text: str) -> Set[str]:
    """Every lexicon topic the text mentions."""
    if not isinstance(text, str) or not text:
        return set()

    found: Set[str] = set()
    # The questionnaire writes both genders into one token ("מנהל/ת",
    # "עליו/עליה"), so a slash separates words just like a space does.
    for raw_word in text.replace("־", " ").replace("/", " ").split():
        word = raw_word.strip(".,:;()\"'!?…")
        if not word:
            continue
        for form in _word_forms(word):
            found |= _TOPIC_BY_WORD.get(form, set())
    return found
