import { Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { Home } from './pages/Home';
import { CompanyEarnings } from './pages/CompanyEarnings';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Navigation />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/company/:symbol" element={<CompanyEarnings />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
