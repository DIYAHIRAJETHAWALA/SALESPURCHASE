import os
import sys
import importlib.util

# Path to the compiled analyzer core
_curr_dir = os.path.dirname(os.path.abspath(__file__))
_pyc_path = os.path.join(_curr_dir, "__pycache__", "combo_category_analyzer.cpython-313.pyc")

if os.path.exists(_pyc_path):
    _spec = importlib.util.spec_from_file_location("combo_category_analyzer_core", _pyc_path)
    _core = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_core)

    CategoryComboAnalyzer = _core.CategoryComboAnalyzer
    clean_outlet_name = _core.clean_outlet_name
    PACK_CONVERSIONS = _core.PACK_CONVERSIONS
    COMBO_DEFINITIONS = _core.COMBO_DEFINITIONS
    CATEGORY_MAPPING = _core.CATEGORY_MAPPING
    SALES_CSV_PATH = _core.SALES_CSV_PATH
    ORDERS_XLSX_PATH = _core.ORDERS_XLSX_PATH
    OUTPUT_EXCEL_PATH = _core.OUTPUT_EXCEL_PATH
    analyzer = _core.analyzer
else:
    raise ImportError(f"Analyzer core pyc not found at {_pyc_path}")

__all__ = [
    "CategoryComboAnalyzer",
    "clean_outlet_name",
    "PACK_CONVERSIONS",
    "COMBO_DEFINITIONS",
    "CATEGORY_MAPPING",
    "SALES_CSV_PATH",
    "ORDERS_XLSX_PATH",
    "OUTPUT_EXCEL_PATH",
    "analyzer",
]
