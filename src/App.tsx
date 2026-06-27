import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProteinSearchPage } from './modules/protein-search/pages/ProteinSearchPage';
import { ArticleSearchPage } from './modules/article-search/pages/ArticleSearchPage';
import { ArticleSummaryPage } from './modules/article-search/pages/ArticleSummaryPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProteinSearchPage />} />
        <Route path="/article-search" element={<ArticleSearchPage />} />
        <Route path="/article-summary" element={<ArticleSummaryPage />} />
      </Routes>
    </BrowserRouter>
  );
}
