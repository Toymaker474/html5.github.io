"""Sandbox God Genic optional Python teacher.

The default hourly teacher is implemented in small JavaScript so iPhone startup
remains safe. This pure-Python audit model runs through Pyodide only when the
owner explicitly loads it.
"""
from __future__ import annotations
import json
from dataclasses import dataclass
from typing import Mapping

@dataclass(frozen=True)
class Audit:
    score: int
    focus: str
    report: str

def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))

def score(metrics: Mapping[str, float]) -> Audit:
    population = float(metrics.get("population", 0))
    species = float(metrics.get("species", 0))
    diversity = float(metrics.get("diversity", 0))
    mean_energy = float(metrics.get("meanEnergy", 0))
    generation = float(metrics.get("generation", 1))
    recent_deaths = float(metrics.get("recentDeaths", 0))
    axes = {
        "survival": _clamp(population / 260.0 * 100.0),
        "diversity": _clamp(diversity * 100.0),
        "efficiency": _clamp(100.0 - abs(0.62 - mean_energy) * 130.0),
        "novelty": _clamp(species * 8.0 + generation * 1.8),
        "stability": _clamp(100.0 - recent_deaths * 3.0),
    }
    weights = {"survival": .27, "diversity": .23, "efficiency": .18, "novelty": .17, "stability": .15}
    total = round(sum(axes[key] * weights[key] for key in axes))
    focus = min(axes, key=axes.get)
    reports = {
        "survival": "Increase route memory and resource discovery rewards.",
        "diversity": "Split habitats and reward niche specialization.",
        "efficiency": "Penalize wasteful motion and reinforce patient feeding.",
        "novelty": "Open a short mutation window for rare strategies.",
        "stability": "Reduce boom-and-crash reproduction pressure.",
    }
    return Audit(total, focus, reports[focus])

def score_json(payload: str) -> str:
    audit = score(json.loads(payload))
    return json.dumps({"score": audit.score, "focus": audit.focus, "report": audit.report})
