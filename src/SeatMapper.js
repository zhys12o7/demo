import React, { useState, useRef, useEffect } from 'react';
import './SeatMapper.css';



const SEAT_RADIUS = 8;

function SeatMapper({ onSaveAndProceed }) {
  const [image, setImage] = useState(null);
  const [seats, setSeats] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentTool, setCurrentTool] = useState({ mode: 'draw', type: 'line' });
  const [dragInfo, setDragInfo] = useState({ isDragging: false, startX: 0, startY: 0, endX: 0, endY: 0 });

  const [pendingSeats, setPendingSeats] = useState([]);
  const [isRotating, setIsRotating] = useState(false);
  const [isScaling, setIsScaling] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [gridScale, setGridScale] = useState(1);
  const [gridCenter, setGridCenter] = useState(null);
  const [gridBoundingBox, setGridBoundingBox] = useState(null);
  const [initialScaleDistance, setInitialScaleDistance] = useState(0);

  const imageRef = useRef(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // --- ✨ 수정된 이미지 크기 감지 로직 ---
  useEffect(() => {
    const updateDimensions = () => {
      if (imageRef.current) {
        setImageDimensions({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight,
        });
      }
    };

    const currentImageRef = imageRef.current;
    if (!currentImageRef) return;

    // ResizeObserver를 사용하여 이미지 요소의 크기 변경을 안정적으로 감지
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(currentImageRef);

    // 이미지가 처음 로드될 때 크기를 설정
    currentImageRef.addEventListener('load', updateDimensions);
    
    // 컴포넌트가 언마운트될 때 옵저버와 이벤트 리스너 정리
    return () => {
      resizeObserver.unobserve(currentImageRef);
      currentImageRef.removeEventListener('load', updateDimensions);
    };
  }, [image]); // 이미지가 바뀔 때만 이 effect를 재실행합니다.

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(URL.createObjectURL(file));
      setSeats([]);
      setHistory([]);
      cancelPendingSeats();
    }
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    if (pendingSeats.length > 0) return;
    setDragInfo({ isDragging: true, startX: e.nativeEvent.offsetX, startY: e.nativeEvent.offsetY, endX: e.nativeEvent.offsetX, endY: e.nativeEvent.offsetY });
  };

  const handleMouseMove = (e) => {
    e.preventDefault();
    if (isRotating) { handleRotation(e); return; }
    if (isScaling) { handleScaling(e); return; }
    if (!dragInfo.isDragging) return;
    setDragInfo({ ...dragInfo, endX: e.nativeEvent.offsetX, endY: e.nativeEvent.offsetY });
  };

  const handleMouseUp = (e) => {
    e.preventDefault();
    if (isRotating) { setIsRotating(false); return; }
    if (isScaling) { setIsScaling(false); return; }
    if (!dragInfo.isDragging) return;
    setDragInfo({ ...dragInfo, isDragging: false });
    if (Math.abs(dragInfo.startX - dragInfo.endX) < 5 && Math.abs(dragInfo.startY - dragInfo.endY) < 5) return;

    if (currentTool.mode === 'draw' && currentTool.type === 'grid') {
      const rows = parseInt(prompt('생성할 행(세로) 개수:'), 10);
      const cols = parseInt(prompt('생성할 열(가로) 개수:'), 10);
      if (!isNaN(rows) && rows > 0 && !isNaN(cols) && cols > 0) {
        generatePendingGrid(rows, cols);
      }
    } else {
      setHistory(prev => [...prev, seats]);
      if (currentTool.mode === 'draw' && currentTool.type === 'line') {
        const count = parseInt(prompt('생성할 좌석 개수(한 줄):'), 10);
        if (!isNaN(count) && count > 0) generateSeatsInBox(count);
      } else if (currentTool.mode === 'erase') {
        eraseSeatsInBox();
      }
    }
  };
  
  const generatePendingGrid = (rows, cols) => {
    const tempSeats = [];
    const { startX, endX, startY, endY } = dragInfo;
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);
    const hStep = (cols > 1) ? (maxX - minX) / (cols - 1) : 0;
    const vStep = (rows > 1) ? (maxY - minY) / (rows - 1) : 0;
    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const x = (cols === 1) ? centerX : minX + (j * hStep);
        const y = (rows === 1) ? centerY : minY + (i * vStep);
        tempSeats.push({ id: `pending-${i}-${j}`, x: x - centerX, y: y - centerY });
      }
    }
    setPendingSeats(tempSeats);
    setGridCenter({ x: centerX, y: centerY });
    setGridBoundingBox({ x: -(maxX - minX) / 2, y: -(maxY - minY) / 2, width: maxX - minX, height: maxY - minY });
    setRotationAngle(0);
    setGridScale(1);
  };

  const handleRotationStart = (e) => { e.preventDefault(); e.stopPropagation(); setIsRotating(true); };
  const handleRotation = (e) => {
    if (!isRotating || !gridCenter) return;
    const angle = Math.atan2(e.nativeEvent.offsetY - gridCenter.y, e.nativeEvent.offsetX - gridCenter.x) * (180 / Math.PI);
    setRotationAngle(angle + 90);
  };
  const handleScaleStart = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsScaling(true);
    const dist = Math.sqrt(Math.pow(e.nativeEvent.offsetX - gridCenter.x, 2) + Math.pow(e.nativeEvent.offsetY - gridCenter.y, 2));
    setInitialScaleDistance(dist / gridScale);
  };
  const handleScaling = (e) => {
    if (!isScaling || !gridCenter || initialScaleDistance === 0) return;
    const currentDist = Math.sqrt(Math.pow(e.nativeEvent.offsetX - gridCenter.x, 2) + Math.pow(e.nativeEvent.offsetY - gridCenter.y, 2));
    setGridScale(currentDist / initialScaleDistance);
  };

  const confirmPendingSeats = () => {
    const { width, height } = imageDimensions;
    if (width === 0 || height === 0) return;
    const angleRad = rotationAngle * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const newSeats = pendingSeats.map((seat, index) => {
      let { x, y } = seat;
      x *= gridScale; y *= gridScale;
      const rotatedX = x * cos - y * sin + gridCenter.x;
      const rotatedY = x * sin + y * cos + gridCenter.y;
      return { 
        id: `seat-${Date.now()}-${index}`, 
        x: rotatedX / width,
        y: rotatedY / height,
        label: ''
      };
    });
    setHistory(prev => [...prev, seats]);
    setSeats(prev => [...prev, ...newSeats]);
    cancelPendingSeats();
  };

  const cancelPendingSeats = () => {
    setPendingSeats([]); setGridCenter(null); setGridBoundingBox(null);
    setRotationAngle(0); setGridScale(1); setIsRotating(false); setIsScaling(false);
  };
  
  const generateSeatsInBox = (count) => {
    const { width, height } = imageDimensions;
    if (width === 0 || height === 0) return;
    const newSeats = [];
    const { startX, endX, startY, endY } = dragInfo;
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const step = (count > 1) ? (maxX - minX) / (count - 1) : 0;
    for (let i = 0; i < count; i++) {
        const x = (count === 1) ? minX + (maxX - minX) / 2 : minX + (i * step);
        const y = startY + (endY - startY) / 2;
        newSeats.push({ 
          id: `seat-${Date.now()}-${i}`, 
          x: x / width, 
          y: y / height,
          label: ''
        });
    }
    setSeats(prev => [...prev, ...newSeats]);
  };
  
  const eraseSeatsInBox = () => {
    const { width, height } = imageDimensions;
    if (width === 0 || height === 0) return;
    const { startX, endX, startY, endY } = dragInfo;
    const minX = Math.min(startX, endX) / width;
    const maxX = Math.max(startX, endX) / width;
    const minY = Math.min(startY, endY) / height;
    const maxY = Math.max(startY, endY) / height;
    setSeats(prevSeats => prevSeats.filter(
      seat => seat.x < minX || seat.x > maxX || seat.y < minY || seat.y > maxY
    ));
  };
  
  const handleUndo = () => {
    if (history.length === 0) return alert("되돌릴 작업이 없습니다.");
    setSeats(history[history.length - 1]);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleSaveAndProceed = () => {
    if (seats.length === 0) {
      alert("라벨링할 좌석이 없습니다. 좌석을 먼저 생성해주세요.");
      return;
    }
    onSaveAndProceed(seats, image, imageDimensions);
  };

  const getDragRect = () => {
    if (!dragInfo.isDragging) return null;
    return { x: Math.min(dragInfo.startX, dragInfo.endX), y: Math.min(dragInfo.startY, dragInfo.endY), width: Math.abs(dragInfo.startX - dragInfo.endX), height: Math.abs(dragInfo.startY - dragInfo.endY) };
  };

  return (
    <div className="wrapper">
      <h1>1단계: 좌석 배치도 그리기</h1>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      
      
      <div className="toolbar">
        <div className="tool-group">
          <strong>그리기</strong>
          <button onClick={() => setCurrentTool({ mode: 'draw', type: 'line' })} className={currentTool.mode === 'draw' && currentTool.type === 'line' ? 'active' : ''}>✏️ 한 줄</button>
          <button onClick={() => setCurrentTool({ mode: 'draw', type: 'grid' })} className={currentTool.mode === 'draw' && currentTool.type === 'grid' ? 'active' : ''}>🌐 그리드</button>
        </div>
        <div className="tool-group">
          <strong>지우기</strong>
          <button onClick={() => setCurrentTool({ mode: 'erase', type: 'area' })} className={currentTool.mode === 'erase' ? 'active' : ''}>❌ 영역</button>
        </div>
        <div className="tool-group">
          <strong>작업</strong>
          <button onClick={handleUndo} disabled={history.length === 0}>↩️ 되돌리기</button>
          <button onClick={handleSaveAndProceed} disabled={seats.length === 0} className="save-button">
            💾 저장하고 라벨링하기
          </button>
        </div>
      </div>
      
      {pendingSeats.length > 0 && (
          <div className="tool-group confirmation-group">
              <strong>그리드 편집</strong>
              <button onClick={confirmPendingSeats} className="confirm-button">✅ 확정</button>
              <button onClick={cancelPendingSeats} className="cancel-button">🚫 취소</button>
          </div>
      )}

      <div className="mapper-container">
        {image && <img 
          ref={imageRef} 
          src={image} 
          alt="Seat map background"
        />}
        {image && (
          <svg 
            className={`svg-overlay tool-${currentTool.mode}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
                if (dragInfo.isDragging) setDragInfo({...dragInfo, isDragging: false});
                if (isRotating) setIsRotating(false);
                if (isScaling) setIsScaling(false);
            }}
          >
            {seats.map(seat => (
              <circle 
                key={seat.id} 
                cx={seat.x * imageDimensions.width} 
                cy={seat.y * imageDimensions.height} 
                r={SEAT_RADIUS} 
                className="seat-circle" 
              />
            ))}
            
            {pendingSeats.length > 0 && gridCenter && (
              <g transform={`translate(${gridCenter.x}, ${gridCenter.y}) rotate(${rotationAngle})`}>
                <g transform={`scale(${gridScale})`}>
                  {pendingSeats.map(seat => (
                    <circle key={seat.id} cx={seat.x} cy={seat.y} r={SEAT_RADIUS} className="seat-circle pending" />
                  ))}
                  {gridBoundingBox && (
                      <rect {...gridBoundingBox} className="grid-bounding-box" />
                  )}
                </g>
                <line x1={0} y1={0} x2={0} y2={-20 - (gridBoundingBox.height / 2 * gridScale)} stroke="#007bff" strokeWidth="2" />
                <circle cy={-20 - (gridBoundingBox.height / 2 * gridScale)} r="8" fill="#007bff" className="rotation-handle" onMouseDown={handleRotationStart}/>
                 {gridBoundingBox && ['nw', 'ne', 'sw', 'se'].map(corner => {
                    const cornerX = gridBoundingBox.x + (corner.includes('e') ? gridBoundingBox.width : 0);
                    const cornerY = gridBoundingBox.y + (corner.includes('s') ? gridBoundingBox.height : 0);
                    return (
                        <rect key={corner} className={`scale-handle scale-handle-${corner}`} x={cornerX * gridScale - 5} y={cornerY * gridScale - 5} width="10" height="10" onMouseDown={handleScaleStart}/>
                    );
                })}
              </g>
            )}
            
            {dragInfo.isDragging && ( <rect {...getDragRect()} className={`drag-rectangle mode-${currentTool.mode}`} /> )}
          </svg>
        )}
      </div>
    </div>
  );
}

export default SeatMapper;