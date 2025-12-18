import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navigation.css';

export function Navigation() {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="navigation">
            <div className="nav-content">
                <Link to="/" className="brand">
                    <span className="brand-icon">📈</span>
                    <span className="brand-text">EarningsTracker</span>
                </Link>

                <div className="nav-links">
                    {isAuthenticated ? (
                        <>
                            <Link to="/dashboard" className="nav-link">Dashboard</Link>
                            <button onClick={handleLogout} className="logout-btn">Logout</button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="nav-link">Login</Link>
                            <Link to="/signup" className="signup-btn">Get Started</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
