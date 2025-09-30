import React, { useState, useEffect } from 'react';
import './App.css';
import SeatMapper from './SeatMapper';
import Labeler from './Labeler'; //  ileride ekleyeceğimiz Labeler componentini import ediyoruz

function App() {
  const [currentPage, setCurrentPage] = useState('mapper'); // 'mapper' veya 'labeler'
  const [dataForLabeler, setDataForLabeler] = useState(null);

  // SeatMapper'dan Labeler'a geçiş yapacak fonksiyon
  const goToLabeler = (
    seats, image, imageDimensions
    ) => {
    setDataForLabeler({ seats, image, imageDimensions });
    setCurrentPage('labeler');
  };

  // Labeler'dan SeatMapper'a geri dönecek fonksiyon
  const goToMapper = () => {
    setDataForLabeler(null);
    setCurrentPage('mapper');
  };

  return (
    <div className="App">
      {currentPage === 'mapper' ? (
        <SeatMapper onSaveAndProceed={goToLabeler} />
      ) : (
        <Labeler data={dataForLabeler} onBack={goToMapper} />
      )}
    </div>
  );
}

export default App;