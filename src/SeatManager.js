import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import './SeatManager.css';

// 좌석의 가능한 상태 정의
const SEAT_STATUSES = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  TAKEN: 'taken',
};

// 각 상태별 다음 상태를 반환하는 함수
const getNextStatus = (currentStatus) => {
  switch (currentStatus) {
    case SEAT_STATUSES.AVAILABLE: return SEAT_STATUSES.RESERVED;
    case SEAT_STATUSES.RESERVED: return SEAT_STATUSES.TAKEN;
    case SEAT_STATUSES.TAKEN: return SEAT_STATUSES.AVAILABLE;
    default: return SEAT_STATUSES.AVAILABLE;
  }
};

function SeatManager() {
  const [seatLayout, setSeatLayout] = useState([]);
  const [fileName, setFileName] = useState('');
  const [editMode, setEditMode] = useState(null); // 'label', 'delete', 'add', 'addRowName', 'stage'
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(new Set());
  const [stageArea, setStageArea] = useState(null); // { startRow, startCol, endRow, endCol }
  const [dragStartCell, setDragStartCell] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => {
    const handleMouseUpGlobal = () => {
        setIsDragging(false);
        setDragStartCell(null);
    };
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, []);


  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        if (data.length === 0) {
          alert("파일에 좌석 데이터가 없습니다.");
          return;
        }

        const newLayout = data.map((row, rowIndex) =>
          row.map((cellValue, colIndex) => {
            if (cellValue === null || String(cellValue).trim() === '') {
              return null;
            }
            return {
              id: `r${rowIndex}-c${colIndex}-${Date.now()}`,
              label: String(cellValue),
              status: SEAT_STATUSES.AVAILABLE,
            };
          })
        );
        setSeatLayout(newLayout);
        alert(`엑셀 파일의 좌석 배치를 성공적으로 불러왔습니다.`);
      } catch (error) {
        alert(`파일 처리 중 오류가 발생했습니다: ${error.message}`);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleSeatClick = (seat) => {
    if (editMode === 'delete') {
      const newSelected = new Set(selectedSeats);
      if (newSelected.has(seat.id)) {
        newSelected.delete(seat.id);
      } else {
        newSelected.add(seat.id);
      }
      setSelectedSeats(newSelected);
    } else if (editMode === 'label') {
      const newLabel = prompt(`좌석 라벨 수정 (현재: ${seat.label}):`, seat.label);
      if (newLabel && newLabel.trim() !== '') {
        const newLayout = seatLayout.map(row =>
          row.map(s => (s && s.id === seat.id ? { ...s, label: newLabel } : s))
        );
        setSeatLayout(newLayout);
      }
    } else if (!editMode) {
      const newLayout = seatLayout.map(row =>
        row.map(s => (s && s.id === seat.id ? { ...s, status: getNextStatus(s.status) } : s))
      );
      setSeatLayout(newLayout);
    }
  };

  const handleEmptySpaceClick = (rowIndex, colIndex) => {
    if (editMode === 'add') {
      const newLabel = prompt('새 좌석의 라벨을 입력하세요:');
      if (newLabel && newLabel.trim() !== '') {
        const newLayout = [...seatLayout];
        while (newLayout.length <= rowIndex) {
          newLayout.push([]);
        }
        const maxCols = Math.max(...newLayout.map(r => r.length), colIndex + 1);
        for(let i = 0; i < newLayout.length; i++){
            while(newLayout[i].length < maxCols) newLayout[i].push(null);
        }
        newLayout[rowIndex][colIndex] = {
          id: `r${rowIndex}-c${colIndex}-${Date.now()}`,
          label: newLabel,
          status: SEAT_STATUSES.AVAILABLE,
        };
        setSeatLayout(newLayout);
      }
    }
  };

  // --- 드래그 선택 및 무대 설정 로직 ---
  const getCellCoordsFromEvent = (e) => {
      if (!gridRef.current) return null;
      const gridRect = gridRef.current.getBoundingClientRect();
      const cellWidth = 60 + 4; // 너비 + 갭
      const cellHeight = 35 + 4; // 높이 + 갭
      const scrollLeft = gridRef.current.parentElement.scrollLeft;
      const scrollTop = gridRef.current.parentElement.scrollTop;

      const x = e.clientX - gridRect.left + scrollLeft;
      const y = e.clientY - gridRect.top + scrollTop;

      const col = Math.floor(x / cellWidth);
      const row = Math.floor(y / cellHeight);

      return { row, col };
  }

  const handleMouseDownOnGrid = (e) => {
      const coords = getCellCoordsFromEvent(e);
      if(!coords) return;
      
      setIsDragging(true);
      setDragStartCell(coords);

      if (editMode === 'delete') {
        // 드래그 시작 시, 기존 선택 초기화 안함. Shift 키 누르면 추가 선택 등 구현 가능
      }
  };

  const handleMouseMoveOnGrid = (e) => {
      if (!isDragging || !dragStartCell) return;
      const currentCoords = getCellCoordsFromEvent(e);
      if(!currentCoords) return;

      const startRow = Math.min(dragStartCell.row, currentCoords.row);
      const endRow = Math.max(dragStartCell.row, currentCoords.row);
      const startCol = Math.min(dragStartCell.col, currentCoords.col);
      const endCol = Math.max(dragStartCell.col, currentCoords.col);

      if (editMode === 'stage') {
          setStageArea({ startRow, startCol, endRow, endCol });
      } else if (editMode === 'delete') {
          const newSelected = new Set(selectedSeats);
          for (let r = startRow; r <= endRow; r++) {
              for (let c = startCol; c <= endCol; c++) {
                  if (seatLayout[r] && seatLayout[r][c]) {
                      newSelected.add(seatLayout[r][c].id);
                  }
              }
          }
          setSelectedSeats(newSelected);
      }
  };


  const deleteSelectedSeats = () => {
    if (selectedSeats.size === 0) {
      alert("삭제할 좌석을 먼저 선택하세요.");
      return;
    }
    if (window.confirm(`${selectedSeats.size}개의 좌석을 정말로 삭제하시겠습니까?`)) {
      const newLayout = seatLayout.map(row =>
        row.map(s => (s && selectedSeats.has(s.id) ? null : s))
      );
      setSeatLayout(newLayout);
      setSelectedSeats(new Set());
    }
  };

  // --- 행 이름 일괄 지정 ---
  const handleAutoRowNaming = () => {
    const startChar = prompt("시작할 행 이름을 입력하세요 (예: A, 가, 1):");
    if (!startChar) return;

    const direction = prompt("방향을 선택하세요:\n1: 위에서 아래로 (A, B, C...)\n2: 아래에서 위로 (A, B, C...)");
    if (direction !== '1' && direction !== '2') {
        alert("1 또는 2를 입력해주세요.");
        return;
    }

    const newLayout = [...seatLayout];
    let currentCharCode = startChar.charCodeAt(0);

    const rows = direction === '1' ? newLayout : [...newLayout].reverse();

    rows.forEach(row => {
        let hasSeats = false;
        row.forEach(seat => {
            if (seat) {
                const numberPart = seat.label.replace(/[^0-9]/g, '');
                seat.label = `${String.fromCharCode(currentCharCode)}${numberPart}`;
                hasSeats = true;
            }
        });
        if (hasSeats) {
            currentCharCode++;
        }
    });
    
    setSeatLayout(direction === '1' ? rows : rows.reverse());
    alert("행 이름이 일괄 적용되었습니다.");
  };

  const handleDownload = () => {
    if (seatLayout.length === 0) return alert("데이터가 없습니다.");
    const dataToExport = seatLayout.map(row =>
      row.map(seat => (seat ? seat.label : null))
    );
    const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Seat Layout");
    XLSX.writeFile(workbook, `seat_layout_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleSave = () => {
    if (seatLayout.length === 0 && !stageArea) {
        alert("저장할 데이터가 없습니다.");
        return;
    }
    const saveData = {
        fileName: fileName || `seat_layout_${new Date().toISOString().slice(0, 10)}`,
        layout: seatLayout,
        stage: stageArea,
    };
    console.log("저장할 데이터 (JSON):", JSON.stringify(saveData, null, 2));
    alert("현재 배치가 JSON 형태로 콘솔에 저장되었습니다.");
  };

  return (
    <div className="seat-manager-container">
      <h1>엑셀 좌석 배치 시스템</h1>
      <p>엑셀 파일을 업로드하거나, 아래 편집 도구를 사용하여 좌석을 직접 배치하세요.</p>

      <div className="controls">
        <label className="file-upload-label">
          📁 엑셀 파일 업로드
          <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
        </label>
        <button onClick={handleDownload} disabled={seatLayout.length === 0} className="download-button">
          💾 배치 다운로드 (Excel)
        </button>
        <button onClick={handleSave} className="save-button">
          💾 현재 배치 저장 (JSON)
        </button>
      </div>

      <div className="edit-controls">
        <span><b>편집 도구: </b></span>
        <button onClick={() => setEditMode(editMode === 'label' ? null : 'label')} className={editMode === 'label' ? 'active' : ''}>라벨 수정</button>
        <button onClick={() => setEditMode(editMode === 'add' ? null : 'add')} className={editMode === 'add' ? 'active' : ''}>좌석 추가</button>
        <button onClick={() => setEditMode(editMode === 'delete' ? null : 'delete')} className={editMode === 'delete' ? 'active' : ''}>삭제 모드</button>
        <button onClick={handleAutoRowNaming}>행 이름 일괄 지정</button>
        <button onClick={() => setEditMode(editMode === 'stage' ? null : 'stage')} className={editMode === 'stage' ? 'active' : ''}>무대 위치</button>

        {editMode === 'delete' && (
          <button onClick={deleteSelectedSeats} className="row-delete-button" disabled={selectedSeats.size === 0}>
            선택 좌석 삭제 ({selectedSeats.size}개)
          </button>
        )}
      </div>

      {fileName && <p className="file-info">현재 파일: {fileName}</p>}

      <div className="seat-layout-grid-wrapper">
        <div
            className="seat-layout-grid"
            ref={gridRef}
            onMouseDown={handleMouseDownOnGrid}
            onMouseMove={handleMouseMoveOnGrid}
        >
          {seatLayout.map((row, rowIndex) => (
            <div key={rowIndex} className="seat-row">
              {row.map((seat, colIndex) => (
                <div key={colIndex} className="seat-cell" onClick={() => !seat && handleEmptySpaceClick(rowIndex, colIndex)}>
                  {seat ? (
                    <button
                      className={`seat-button ${seat.status} ${selectedSeats.has(seat.id) ? 'selected' : ''}`}
                      onClick={() => handleSeatClick(seat)}
                      onMouseDown={(e) => e.stopPropagation()} // 그리드 이벤트와 충돌 방지
                    >
                      {seat.label}
                    </button>
                  ) : (
                    <div className="empty-space"></div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* 무대 표시 */}
          {stageArea && (
              <div
                  className="stage-area"
                  style={{
                      top: `${stageArea.startRow * (35 + 4)}px`,
                      left: `${stageArea.startCol * (60 + 4)}px`,
                      width: `${(stageArea.endCol - stageArea.startCol + 1) * (60 + 4) - 4}px`,
                      height: `${(stageArea.endRow - stageArea.startRow + 1) * (35 + 4) - 4}px`,
                  }}
              >
                <div className="stage-text">무대 (STAGE)</div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SeatManager;