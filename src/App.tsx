import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProteinSearchPage } from './modules/protein-search/pages/ProteinSearchPage';
import { ArticleSearchPage } from './modules/article-search/pages/ArticleSearchPage';

const ArticleSummaryPage = lazy(() =>
  import('./modules/article-search/pages/ArticleSummaryPage').then((m) => ({ default: m.ArticleSummaryPage })),
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProteinSearchPage />} />
        <Route path="/article-search" element={<ArticleSearchPage />} />
        <Route
          path="/article-summary"
          element={
            <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>}>
              <ArticleSummaryPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
