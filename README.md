# Gen-Z — AI Ambulance Allocation System

> Full-stack emergency dispatch platform powered by ML + Genetic Algorithm — deployable across any Indian city.

---

## Repository Structure

```
Gen-Z/
├── ai-ml/          AI/ML microservice (FastAPI + 3 ML models + GA engine)
├── docs/           Architecture, API spec, design docs
└── README.md       This file
```

## Services

### `ai-ml/` — AI/ML Microservice

A production-ready FastAPI service that classifies emergency priority, estimates hotspot risk, predicts traffic congestion, and dispatches the optimal ambulance using a custom Genetic Algorithm.

**Tech stack:** Python 3.11 · FastAPI · scikit-learn · pandas · joblib  
**Deployment:** Render (Singapore region) — pre-trained models committed, no retraining on server  
**Docs:** [ai-ml/README.md](./ai-ml/README.md) · [ai-ml/api_doc.md](./ai-ml/api_doc.md)

**Live endpoints:**
| Endpoint | Description |
|----------|-------------|
| `GET /health` | Service liveness + model status |
| `POST /predict-priority` | Emergency severity: Low → Critical |
| `POST /predict-hotspot` | Location risk score 0–1 |
| `POST /predict-traffic` | Congestion % + ETA multiplier |
| `POST /optimize-ambulance` | GA dispatch — best unit + backups |

**Verified for:** Kolkata · Delhi · Mumbai · Bangalore · Hyderabad · Chennai · Pune · Jaipur · Lucknow · Ahmedabad

## Deployment

See [ai-ml/README.md → Deployment on Render](./ai-ml/README.md#deployment-on-render) for full instructions.

Quick deploy:
1. Connect this GitHub repo to [render.com](https://render.com)
2. Point to `ai-ml/` as root → Render auto-reads `render.yaml`
3. Live in ~2 minutes

## Documentation

- [Design](./docs/design.md)
- [Architecture](./docs/architecture.md)
- [Tech Stack](./docs/tech_stack.md)
- [API Specification](./docs/api.md)
- [Workflow](./docs/workflow.md)
- [AI/ML API Reference](./ai-ml/api_doc.md)
