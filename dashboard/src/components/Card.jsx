import './Card.css';

function Card({ title, value, subtitle, children }) {
    return (
        <div className="card">
            {title && <h3 className="card-title">{title}</h3>}
            {value !== undefined && <div className="card-value">{value}</div>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
            {children}
        </div>
    );
}

export default Card;
