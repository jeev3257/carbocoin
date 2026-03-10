import React from 'react';

const Background = () => {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none bg-[#0d131c]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#047857]/30 via-[#0d131c]/50 to-[#10b981]/20 mix-blend-color-dodge"></div>
      <div 
        className="absolute inset-0 opacity-40 mix-blend-color-dodge" 
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, #10b981 0%, transparent 50%)',
          backgroundSize: '100% 100%'
        }}
      ></div>
    </div>
  );
};

export default Background;
