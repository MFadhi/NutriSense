import re
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

try:
    from PIL import Image
    import pytesseract
    HAS_PYTESSERACT = True
except ImportError:
    HAS_PYTESSERACT = False

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

# Mapping of canonical parameter key to list of regex patterns and default standard units
PARAMETER_PATTERNS = {
    "fasting_blood_glucose": {
        "display_name": "Fasting Blood Glucose",
        "standard_unit": "mg/dL",
        "patterns": [
            r"(?:fasting\s+blood\s+(?:sugar|glucose)|fbs|glucose[,\s]+fasting|fasting\s+glucose)",
        ],
        "units": ["mg/dL", "mg/dl", "mmol/L", "mmol/l"],
    },
    "hba1c": {
        "display_name": "HbA1c",
        "standard_unit": "%",
        "patterns": [
            r"(?:glycated\s+h[ae]moglobin|glycosylated\s+h[ae]moglobin|hb\s*a1c|hba1c|a1c)",
        ],
        "units": ["%", "mmol/mol"],
    },
    "ldl_cholesterol": {
        "display_name": "LDL Cholesterol",
        "standard_unit": "mg/dL",
        "patterns": [
            r"(?:ldl\s+cholesterol|ldl[,\s]+direct|low\s+density\s+lipoprotein|cholesterol[,\s]+ldl|ldl)",
        ],
        "units": ["mg/dL", "mg/dl", "mmol/L", "mmol/l"],
    },
    "hdl_cholesterol": {
        "display_name": "HDL Cholesterol",
        "standard_unit": "mg/dL",
        "patterns": [
            r"(?:hdl\s+cholesterol|hdl[,\s]+direct|high\s+density\s+lipoprotein|cholesterol[,\s]+hdl|hdl)",
        ],
        "units": ["mg/dL", "mg/dl", "mmol/L", "mmol/l"],
    },
    "triglycerides": {
        "display_name": "Triglycerides",
        "standard_unit": "mg/dL",
        "patterns": [
            r"(?:triglycerides|serum\s+triglycerides|triglyceride|tg)",
        ],
        "units": ["mg/dL", "mg/dl", "mmol/L", "mmol/l"],
    },
    "haemoglobin": {
        "display_name": "Haemoglobin",
        "standard_unit": "g/dL",
        "patterns": [
            r"(?:h[ae]moglobin|hb|hgb)",
        ],
        "units": ["g/dL", "g/dl", "g/L", "g/l"],
    },
    "vitamin_d": {
        "display_name": "Vitamin D (25-OH)",
        "standard_unit": "ng/mL",
        "patterns": [
            r"(?:25\s*-\s*hydroxy\s*vitamin\s*d|25\s*-\s*oh\s*vitamin\s*d|vitamin\s*d\s*\(?25\s*-\s*oh\)?|vit(?:amin)?\s*d3?|calcidiol)",
        ],
        "units": ["ng/mL", "ng/ml", "nmol/L", "nmol/l"],
    },
    "vitamin_b12": {
        "display_name": "Vitamin B12",
        "standard_unit": "pg/mL",
        "patterns": [
            r"(?:vitamin\s*b\s*12|vit(?:amin)?\s*b12|cyanocobalamin|cobalamin)",
        ],
        "units": ["pg/mL", "pg/ml", "pmol/L", "pmol/l"],
    },
}


def extract_text_from_file(file_path: str, mime_type: str) -> str:
    """
    Extracts text from PDF or image using pypdf or pytesseract.
    """
    if not os.path.exists(file_path):
        return ""

    text = ""
    # 1. PDF
    if mime_type == "application/pdf" or file_path.lower().endswith(".pdf"):
        if HAS_PYPDF:
            try:
                reader = PdfReader(file_path)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            except Exception:
                pass

    # 2. Image or PDF fallback
    if not text.strip() and HAS_PYTESSERACT:
        try:
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)
        except Exception:
            pass

    return text


def extract_test_date(text: str) -> Optional[str]:
    """
    Attempts to identify a test date from the document text.
    Returns ISO date string (YYYY-MM-DD) if found, or None.
    """
    date_patterns = [
        # YYYY-MM-DD
        r"(?:date|collected|reported|sample\s*date)[:\s]+(\d{4}[-/]\d{2}[-/]\d{2})",
        # DD-MM-YYYY or DD/MM/YYYY
        r"(?:date|collected|reported|sample\s*date)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})",
        # Standalone DD/MM/YYYY or YYYY-MM-DD
        r"\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b",
    ]

    for pat in date_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            raw_date = match.group(1).replace("/", "-")
            parts = raw_date.split("-")
            try:
                if len(parts) == 3:
                    if len(parts[0]) == 4:  # YYYY-MM-DD
                        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                    else:  # DD-MM-YYYY
                        d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                    return f"{y:04d}-{m:02d}-{d:02d}"
            except Exception:
                continue

    return None


def parse_lab_parameters_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Scans the extracted text for supported laboratory parameters, values, and units.
    Returns a list of unconfirmed draft results with confidence score.
    """
    if not text:
        return []

    results = []
    lines = text.splitlines()

    for param_key, meta in PARAMETER_PATTERNS.items():
        found = False
        display_name = meta["display_name"]
        default_unit = meta["standard_unit"]

        for line in lines:
            if found:
                break
            clean_line = line.strip()
            if not clean_line:
                continue

            for pattern in meta["patterns"]:
                # Match parameter name followed by optional delimiters and a number
                # e.g., "Fasting Blood Sugar : 105 mg/dL"
                regex = rf"\b{pattern}\b[\s:\-=|]+(\d+(?:\.\d+)?)"
                match = re.search(regex, clean_line, re.IGNORECASE)

                if match:
                    raw_val = match.group(1)
                    val = float(raw_val)

                    # Check for explicit unit on the same line
                    detected_unit = default_unit
                    for u in meta["units"]:
                        if re.search(rf"\b{re.escape(u)}\b", clean_line, re.IGNORECASE):
                            detected_unit = u
                            break

                    confidence = 0.90
                    # Sanity check ranges for confidence
                    if val <= 0 or val > 2000:
                        confidence = 0.50

                    results.append({
                        "parameter": param_key,
                        "display_name": display_name,
                        "value": val,
                        "unit": detected_unit,
                        "confidence": confidence,
                        "raw_text": clean_line,
                        "needs_review": confidence < 0.70,
                    })
                    found = True
                    break

    return results


def process_report_file(file_path: str, mime_type: str) -> Dict[str, Any]:
    """
    End-to-end extraction from an uploaded file.
    Always returns draft data with user review requirement.
    """
    text = extract_text_from_file(file_path, mime_type)
    test_date = extract_test_date(text) or datetime.now().strftime("%Y-%m-%d")
    draft_parameters = parse_lab_parameters_from_text(text)

    return {
        "test_date": test_date,
        "extracted_parameters": draft_parameters,
        "total_extracted": len(draft_parameters),
        "raw_text_length": len(text),
        "is_draft": True,
        "requires_confirmation": True,
    }
