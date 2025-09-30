import React, {useState, useEffect} from 'react';
import './Labeler.css';

const SEAT_RADIUS = 8;

function Labeler({ data, onBack }) {
    const { seats: initialSeats, image, imageDimensions } = data;

    const [seats, setSeats] = useState(initialSeats);
    const [history, setHistory] = useState([]);
    const [selectedSeats, setSelectedSeats] = useState(new Set());
    const [dragInfo, setDragInfo] = useState({ isDragging: false, startX: 0, startY: 0, endX: 0, endY: 0 });
    const [currentImageDimensions, setCurrentImageDimensions] = useState(imageDimensions);
    
    useEffect(() => {
        setCurrentImageDimensions(imageDimensions);
    }, [imageDimensions]);

    // --- ✨ 직접 수정을 위한 더블클릭 핸들러 ---
    const handleSeatDoubleClick = (seatId) => {
        const seatToEdit = seats.find(s => s.id === seatId);
        if (!seatToEdit) return;

        const currentLabel = seatToEdit.label || "";
        const newLabel = prompt(`좌석 라벨을 입력하세요 (현재: "${currentLabel}"):`, currentLabel);

        // 사용자가 취소를 누르거나, 변경 없이 확인을 누른 경우
        if (newLabel === null || newLabel === currentLabel) {
            return;
        }

        // 새 라벨이 비어있지 않고, 다른 좌석에서 이미 사용 중인지 확인
        if (newLabel !== "" && seats.some(s => s.label === newLabel && s.id !== seatId)) {
            alert(`오류: 라벨 "${newLabel}"은(는) 이미 다른 좌석에서 사용 중입니다. 라벨은 고유해야 합니다.`);
            return;
        }

        // 좌석 상태 업데이트
        const newSeats = seats.map(s => {
            if (s.id === seatId) {
                return { ...s, label: newLabel };
            }
            return s;
        });

        setHistory(prev => [...prev, seats]);
        setSeats(newSeats);
    };


    const handleMouseDown = (e) => {
        e.preventDefault();
        // 더블클릭과 겹치지 않도록 onDoubleClick 이벤트가 있는 g 태그 대신 circle 태그를 직접 타겟
        if (e.target.tagName === 'circle') {
            const seatId = e.target.id;
            // Shift 키를 누른 상태에서 클릭하면 기존 선택에 추가/삭제
            const newSelection = new Set(e.shiftKey ? selectedSeats : []);
            if (newSelection.has(seatId)) {
                newSelection.delete(seatId);
            } else {
                newSelection.add(seatId);
            }
            setSelectedSeats(newSelection);
            return; // 드래그 시작 방지
        }
        // 배경을 클릭했을 때만 드래그 시작
        setDragInfo({ isDragging: true, startX: e.nativeEvent.offsetX, startY: e.nativeEvent.offsetY, endX: e.nativeEvent.offsetX, endY: e.nativeEvent.offsetY });
    };

    const handleMouseMove = (e) => {
        e.preventDefault();
        if (!dragInfo.isDragging) return;
        setDragInfo({ ...dragInfo, endX: e.nativeEvent.offsetX, endY: e.nativeEvent.offsetY });
    };

    const handleMouseUp = (e) => {
        e.preventDefault();
        if (!dragInfo.isDragging) return;
        
        const selectionRect = getDragRect();
        // 드래그 영역이 작으면 단순 클릭으로 간주하고 선택 해제 (shift 키 없을 때)
        if (selectionRect.width < 5 && selectionRect.height < 5) {
            if (!e.shiftKey) {
                setSelectedSeats(new Set());
            }
            setDragInfo({ ...dragInfo, isDragging: false });
            return;
        }

        const selected = new Set(e.shiftKey ? selectedSeats : []);
        seats.forEach(seat => {
            const absX = seat.x * currentImageDimensions.width;
            const absY = seat.y * currentImageDimensions.height;
            if (absX >= selectionRect.x && absX <= selectionRect.x + selectionRect.width &&
                absY >= selectionRect.y && absY <= selectionRect.y + selectionRect.height) {
                selected.add(seat.id);
            }
        });
        setSelectedSeats(selected);
        setDragInfo({ ...dragInfo, isDragging: false });
    };

    const getNextChar = (char) => {
        return String.fromCharCode(char.charCodeAt(0) + 1);
    };

    const parseLabel = (label = '') => {
        const match = label.match(/^([a-zA-Z가-힣]+)?-?(\d+)?$/);
        return {
            charPart: match?.[1] || '',
            numPart: match?.[2] || ''
        };
    };
    
    const handleApplyRowLabels = (direction) => {
        if (selectedSeats.size === 0) return alert('먼저 좌석을 선택하세요.');
        const startChar = prompt('시작할 행 문자를 입력하세요 (예: A)');
        if (!startChar) return;

        const selectedSeatObjects = [...selectedSeats].map(id => seats.find(s => s.id === id));
        const rows = selectedSeatObjects.reduce((acc, seat) => {
            const tolerance = SEAT_RADIUS / currentImageDimensions.height;
            const foundRow = acc.find(r => Math.abs(r.key - seat.y) < tolerance);
            if (foundRow) {
                foundRow.seats.push(seat);
            } else {
                acc.push({ key: seat.y, seats: [seat] });
            }
            return acc;
        }, []);

        rows.sort((a, b) => direction === 'ttb' ? a.key - b.key : b.key - a.key);

        let currentChar = startChar;
        const newSeats = [...seats];

        rows.forEach(row => {
            row.seats.forEach(seat => {
                const seatIndex = newSeats.findIndex(s => s.id === seat.id);
                if (seatIndex > -1) {
                    const { numPart } = parseLabel(newSeats[seatIndex].label);
                    newSeats[seatIndex].label = numPart ? `${currentChar}-${numPart}` : currentChar;
                }
            });
            currentChar = getNextChar(currentChar);
        });
        
        setHistory(prev => [...prev, seats]);
        setSeats(newSeats);
        setSelectedSeats(new Set());
    };

    const handleApplyColLabels = (direction) => {
        if (selectedSeats.size === 0) return alert('먼저 좌석을 선택하세요.');
        const startNumStr = prompt('시작할 열 번호를 입력하세요 (예: 1)');
        if (!startNumStr || isNaN(parseInt(startNumStr, 10))) return;

        let startNum = parseInt(startNumStr, 10);
        const selectedSeatObjects = [...selectedSeats].map(id => seats.find(s => s.id === id));
        
        const rows = selectedSeatObjects.reduce((acc, seat) => {
            const tolerance = SEAT_RADIUS / currentImageDimensions.height;
            const foundRow = acc.find(r => Math.abs(r.key - seat.y) < tolerance);
            if (foundRow) {
                foundRow.seats.push(seat);
            } else {
                acc.push({ key: seat.y, seats: [seat] });
            }
            return acc;
        }, []);
        
        const newSeats = [...seats];

        rows.forEach(row => {
            row.seats.sort((a, b) => direction === 'ltr' ? a.x - b.x : b.x - a.x);
            
            let currentNum = startNum;
            row.seats.forEach(seat => {
                 const seatIndex = newSeats.findIndex(s => s.id === seat.id);
                 if (seatIndex > -1) {
                    const { charPart } = parseLabel(newSeats[seatIndex].label);
                    newSeats[seatIndex].label = charPart ? `${charPart}-${currentNum}` : `${currentNum}`;
                    currentNum++;
                 }
            });
        });
        
        setHistory(prev => [...prev, seats]);
        setSeats(newSeats);
        setSelectedSeats(new Set());
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        setSeats(history[history.length - 1]);
        setHistory(prev => prev.slice(0, -1));
    };

    const handleFinalSave = () => {
        const labeledSeats = seats.filter(s => s.label);
        const unlabeledSeatsCount = seats.length - labeledSeats.length;

        const labels = labeledSeats.map(s => s.label);
        const duplicateLabels = labels.filter((label, index) => labels.indexOf(label) !== index);

        if (duplicateLabels.length > 0) {
            alert(`오류: ID는 고유해야 합니다. 중복된 라벨이 있습니다: ${[...new Set(duplicateLabels)].join(', ')}`);
            return;
        }

        if (unlabeledSeatsCount > 0) {
            if (!window.confirm(`${unlabeledSeatsCount}개의 좌석에 라벨이 없습니다. 라벨이 없는 좌석은 임시 ID로 저장됩니다. 계속하시겠습니까?`)) {
                return;
            }
        }
        
        const finalSeatData = seats.map(seat => ({
            id: seat.label || seat.id,
            x: seat.x,
            y: seat.y
        }));

        console.log("--- 최종 좌석 데이터 (라벨이 ID로 적용됨) ---");
        console.log(JSON.stringify(finalSeatData, null, 2));
        alert('모든 좌석 데이터가 콘솔에 최종 저장되었습니다. (라벨이 ID로 적용됨)');
    };

    const getDragRect = () => {
        if (!dragInfo.isDragging) return null;
        return { x: Math.min(dragInfo.startX, dragInfo.endX), y: Math.min(dragInfo.startY, dragInfo.endY), width: Math.abs(dragInfo.startX - dragInfo.endX), height: Math.abs(dragInfo.startY - dragInfo.endY) };
    };

    return (
        <div className="wrapper">
            <h1>2단계: 좌석 라벨링</h1>
            <div className="toolbar">
                <div className="tool-group">
                    <button onClick={onBack}>↩️ 이전 단계로</button>
                    <button onClick={handleUndo} disabled={history.length === 0}>되돌리기</button>
                    <button onClick={handleFinalSave} className="save-button">💾 최종 저장</button>
                </div>
            </div>

            {selectedSeats.size > 0 && (
                 <div className="toolbar labeling-toolbar">
                 <div className="tool-group">
                     <strong>{selectedSeats.size}개 좌석 선택됨</strong>
                 </div>
                 <div className="tool-group">
                     <strong>행 처리:</strong>
                     <button onClick={() => handleApplyRowLabels('ttb')} title="선택된 행들에 위에서부터 아래로 A, B, C... 라벨을 붙입니다.">위 → 아래</button>
                     <button onClick={() => handleApplyRowLabels('btt')} title="선택된 행들에 아래에서부터 위로 A, B, C... 라벨을 붙입니다.">아래 → 위</button>
                 </div>
                  <div className="tool-group">
                     <strong>열 처리:</strong>
                     <button onClick={() => handleApplyColLabels('ltr')} title="각 행 안에서 왼쪽부터 오른쪽으로 1, 2, 3... 번호를 붙입니다.">좌 → 우</button>
                     <button onClick={() => handleApplyColLabels('rtl')} title="각 행 안에서 오른쪽부터 왼쪽으로 1, 2, 3... 번호를 붙입니다.">우 → 좌</button>
                 </div>
                 <div className="tool-group">
                      <button onClick={() => setSelectedSeats(new Set())} className="cancel-button">🚫 선택 해제</button>
                 </div>
             </div>
            )}
            
            {/* --- ✨ 직접 수정을 위한 안내 문구 --- */}
            <p className="edit-instruction">💡 Tip: 좌석을 더블클릭하면 라벨을 직접 수정할 수 있습니다.</p>

            <div className="mapper-container">
                <img src={image} alt="Seat map background" />
                <svg
                    className="svg-overlay"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    {seats.map(seat => {
                        const absX = seat.x * currentImageDimensions.width;
                        const absY = seat.y * currentImageDimensions.height;
                        return (
                            // --- ✨ g 태그에 onDoubleClick 이벤트 추가 ---
                            <g key={seat.id} onDoubleClick={() => handleSeatDoubleClick(seat.id)}>
                                <circle
                                    id={seat.id}
                                    cx={absX}
                                    cy={absY}
                                    r={SEAT_RADIUS}
                                    className={`seat-circle ${selectedSeats.has(seat.id) ? 'selected' : ''}`}
                                />
                                <text
                                    x={absX}
                                    y={absY}
                                    className="seat-label"
                                    dominantBaseline="middle"
                                    textAnchor="middle"
                                >
                                    {seat.label}
                                </text>
                            </g>
                        )
                    })}
                    {dragInfo.isDragging && (<rect {...getDragRect()} className="drag-rectangle mode-label" />)}
                </svg>
            </div>
        </div>
    );
}

export default Labeler;