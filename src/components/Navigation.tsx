import { Link } from 'react-router-dom';
import './Navigation.css';

export function Navigation() {
    return (
        <nav className="navigation">
            <div className="nav-content">
                <Link to="/" className="brand">
                    <span className="brand-icon">📈</span>
                    <span className="brand-text">EarningsTracker</span>
                </Link>
            </div>
        </nav>
    );
}
