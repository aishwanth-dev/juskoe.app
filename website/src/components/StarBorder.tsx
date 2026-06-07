import './StarBorder.css';
import React from 'react';

interface StarBorderProps {
    as?: React.ElementType;
    className?: string;
    color?: string;
    speed?: string;
    thickness?: number;
    children?: React.ReactNode;
    [key: string]: any;
}

const StarBorder: React.FC<StarBorderProps> = ({
    as: Component = 'div',
    className = '',
    color = 'white',
    speed = '6s',
    children,
    ...rest
}) => {
    return (
        <Component className={`star-border-container ${className}`} {...rest}>
            <div
                className="border-gradient-bottom"
                style={{
                    background: `radial-gradient(circle, ${color}, transparent 10%)`,
                    animationDuration: speed,
                }}
            />
            <div
                className="border-gradient-top"
                style={{
                    background: `radial-gradient(circle, ${color}, transparent 10%)`,
                    animationDuration: speed,
                }}
            />
            <div className="inner-content">
                {children}
            </div>
        </Component>
    );
};

export default StarBorder;
