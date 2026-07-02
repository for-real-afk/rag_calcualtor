# Enterprise RAG Total Cost of Ownership (TCO) Platform

A production-grade, highly configurable web dashboard designed to model and project the **Total Cost of Ownership (TCO)** for modern Retrieval-Augmented Generation (RAG) systems. Inspired by developer-first design systems like **Render.com**.

## 🚀 Key Features

* **15 Cost Domains**: Models document parsing (OCR), chunk overlaps, token storage, vector databases, retrieval compute, reranking layers, prompt templates, agent loop iterations, semantic cache, safety filters, and engineering hours.
* **Dual Currency Support**: Display costs in USD ($) and INR (₹) side-by-side, complete with custom exchange rate configuration.
* **Build vs Buy Engine**: Live feasibility analyzer comparing commercial API pricing against self-hosted GPU containers.
* **Dynamic Sharing (Base64 URL Hash)**: Modifying sliders encodes the state into the URL hash instantly. Copy and share the URL, and others will load the exact same cost configurations.
* **Dynamic pricing database**: Configured inside `pricing_catalog.json`—easily update API rates without writing any JavaScript formulas.

---

## 📂 Project Architecture

```text
rag-tco-platform/
├── vercel.json                 # Vercel deployment routing & caching configuration
├── pricing_catalog.json        # Static JSON pricing database for models & databases
├── src/
│   ├── calculator.js           # Composable cost engine calculations and equations
│   ├── App.jsx                 # Dashboard React UI logic, charts, and toggles
│   ├── App.css                 # Component styles, grids, SVG graphics
│   └── index.css               # Render.com inspired theme properties (Light & Dark)
```

---

## ⚙️ Local Development Setup

To run this project locally, ensure you have [Node.js](https://nodejs.org/) installed:

1. **Clone or navigate to the directory**:
   ```bash
   cd D:/projects/rag-tco-platform
   ```
2. **Install Node dependencies**:
   ```bash
   npm install
   ```
3. **Start the local server**:
   ```bash
   npm run dev
   ```
4. Open the displayed URL (typically `http://localhost:5173`) in your browser.

---

## ☁️ Vercel Production Deployment Guide

Vite React projects deploy to Vercel in seconds using either of these two methods:

### Method A: Deploy via Github Integration (Recommended)
1. Push this project folder to a repository on **GitHub**, **GitLab**, or **Bitbucket**.
2. Log into the [Vercel Dashboard](https://vercel.com).
3. Click **Add New** -> **Project**.
4. Select your imported RAG TCO repository.
5. Vercel automatically detects the **Vite** preset:
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
6. Click **Deploy**. Vercel will build the SPA and host it on a global CDN.

### Method B: Deploy via Vercel CLI
If you prefer deploying directly from your local terminal:
1. Install the Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```
2. Navigate to the project folder and log in:
   ```bash
   vercel login
   ```
3. Deploy the project:
   ```bash
   vercel
   ```
4. Confirm the project options (accept the defaults). Once complete, Vercel will provide a staging deployment link.
5. Deploy to production:
   ```bash
   vercel --prod
   ```
