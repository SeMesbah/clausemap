"""
Tests for app.verify — normalize() and verify_quote().
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.verify import normalize, verify_quote


# ---------------------------------------------------------------------------
# normalize()
# ---------------------------------------------------------------------------

def test_normalize_lowercases():
    assert normalize("Hello World") == "hello world"


def test_normalize_collapses_whitespace():
    assert normalize("foo   bar\t\nbaz") == "foo bar baz"


def test_normalize_curly_single_quotes():
    assert normalize("\u2018hello\u2019") == "'hello'"


def test_normalize_curly_double_quotes():
    assert normalize("\u201chello\u201d") == '"hello"'


def test_normalize_hyphen_newline():
    assert normalize("deliver-\nance") == "deliverance"


# ---------------------------------------------------------------------------
# verify_quote() — True cases
# ---------------------------------------------------------------------------

def test_exact_match():
    page = "The Company shall deliver quarterly reports to the Board."
    quote = "The Company shall deliver quarterly reports to the Board."
    assert verify_quote(quote, page) is True


def test_curly_quotes_vs_straight():
    page = "The Company (hereinafter \u201cthe Company\u201d) agrees."
    quote = 'The Company (hereinafter "the Company") agrees.'
    assert verify_quote(quote, page) is True


def test_hyphen_line_break():
    page = "The Supplier shall deliver-\nance all goods by Q1."
    quote = "The Supplier shall deliverance all goods by Q1."
    assert verify_quote(quote, page) is True


def test_substring_in_longer_page():
    page = (
        "This Agreement is entered into as of January 1, 2024. "
        "The Company shall pay a monthly fee of ten thousand dollars. "
        "Payment is due within 30 days."
    )
    quote = "The Company shall pay a monthly fee of ten thousand dollars."
    assert verify_quote(quote, page) is True


# ---------------------------------------------------------------------------
# verify_quote() — False cases
# ---------------------------------------------------------------------------

def test_paraphrase_fails():
    page = "The Company shall deliver quarterly reports to the Board."
    quote = "The Company must submit periodic reports to the Board."
    assert verify_quote(quote, page) is False


def test_three_word_quote_fails():
    page = "The Company shall deliver reports."
    quote = "Company shall deliver"
    assert verify_quote(quote, page) is False


def test_empty_quote_fails():
    assert verify_quote("", "some page text here with words") is False


def test_quote_not_in_page():
    page = "Nothing relevant here at all."
    quote = "The Company shall pay one million dollars by year end."
    assert verify_quote(quote, page) is False
