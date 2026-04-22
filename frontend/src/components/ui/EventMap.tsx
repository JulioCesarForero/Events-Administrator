import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Circle, Rect, Text, Group, Transformer } from 'react-konva';
import type { MapTable } from '../../api/types';
import { ZoomIn, ZoomOut, Maximize, LayoutGrid, AlignLeft, AlignVerticalJustifyStart as AlignTop } from 'lucide-react';

interface EventMapProps {
  tables: MapTable[];
  onTableClick?: (table: MapTable) => void;
  isAdmin?: boolean;
  onTableMove?: (table: MapTable, x: number, y: number) => void;
  onBulkUpdate?: (updates: { table: MapTable; x: number; y: number }[]) => void;
  width?: number;
  height?: number;
  selectedSpots?: Record<string, number>; // How many spots user has selected for each table
}

function tableId(t: MapTable): string {
  return t.id || t.layoutTableId || '';
}

function tablePosition(t: MapTable): { x: number; y: number } {
  if (t.position && typeof t.position.x === 'number') {
    return { x: t.position.x, y: t.position.y ?? 0 };
  }
  const pj = (t.positionJson || {}) as { x?: number; y?: number };
  return { x: Number(pj.x || 0), y: Number(pj.y || 0) };
}

function getAvailable(t: MapTable): number {
  if (typeof t.availableSpots === 'number') return t.availableSpots;
  if (typeof t.available === 'number') return t.available;
  return Math.max(0, (t.capacity || 0) - (t.occupiedSpots ?? t.occupied ?? 0));
}

function getOccupied(t: MapTable): number {
  if (typeof t.occupiedSpots === 'number') return t.occupiedSpots;
  if (typeof t.occupied === 'number') return t.occupied;
  return 0;
}

export const EventMap: React.FC<EventMapProps> = ({
  tables,
  onTableClick,
  isAdmin,
  onTableMove,
  onBulkUpdate,
  width = 1200,
  // height is omitted since we use responsive height
  selectedSpots = {}
}) => {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<any>(null);
  
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Resize observer to handle container changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Set initial size
    setStageSize({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight
    });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setStageSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sync transformer with selected nodes
  useEffect(() => {
    if (isAdmin && trRef.current && stageRef.current) {
      const selectedNodes = selectedIds
        .map(id => stageRef.current.findOne(`#table-${id}`))
        .filter(Boolean);
      trRef.current.nodes(selectedNodes);
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedIds, isAdmin, tables]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();

    const mousePointTo = {
      x: (stage.getPointerPosition().x - stage.x()) / oldScale,
      y: (stage.getPointerPosition().y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    setScale(newScale);
    setPosition({
      x: stage.getPointerPosition().x - mousePointTo.x * newScale,
      y: stage.getPointerPosition().y - mousePointTo.y * newScale,
    });
  };

  const handleMouseDown = (e: any) => {
    // If clicked on stage background
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.getType() === 'Image';
    if (clickedOnEmpty) {
      if (!isAdmin) return;
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      const scaledPos = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY(),
      };
      setSelectedIds([]);
      setSelectionBox({ x1: scaledPos.x, y1: scaledPos.y, x2: scaledPos.x, y2: scaledPos.y });
    }
  };

  const handleMouseMove = (e: any) => {
    if (!selectionBox || !isAdmin) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const scaledPos = {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
    setSelectionBox({ ...selectionBox, x2: scaledPos.x, y2: scaledPos.y });
  };

  const handleMouseUp = () => {
    if (!selectionBox || !isAdmin) {
      setSelectionBox(null);
      return;
    }
    
    // Find intersections
    const xMin = Math.min(selectionBox.x1, selectionBox.x2);
    const xMax = Math.max(selectionBox.x1, selectionBox.x2);
    const yMin = Math.min(selectionBox.y1, selectionBox.y2);
    const yMax = Math.max(selectionBox.y1, selectionBox.y2);

    const hitIds = tables.filter(t => {
      const pos = tablePosition(t);
      return pos.x >= xMin && pos.x <= xMax && pos.y >= yMin && pos.y <= yMax;
    }).map(t => tableId(t));

    setSelectedIds(hitIds);
    setSelectionBox(null);
  };

  const alignSelection = (direction: 'left' | 'top') => {
    if (!onBulkUpdate || selectedIds.length < 2) return;
    const selectedTables = tables.filter(t => selectedIds.includes(tableId(t)));
    if (selectedTables.length === 0) return;

    if (direction === 'left') {
      const minX = Math.min(...selectedTables.map(t => tablePosition(t).x));
      onBulkUpdate(selectedTables.map(t => ({ table: t, x: minX, y: tablePosition(t).y })));
    } else {
      const minY = Math.min(...selectedTables.map(t => tablePosition(t).y));
      onBulkUpdate(selectedTables.map(t => ({ table: t, x: tablePosition(t).x, y: minY })));
    }
  };

  const distributeSelection = (axis: 'h' | 'v') => {
    if (!onBulkUpdate || selectedIds.length < 3) return;
    const selectedTables = [...tables.filter(t => selectedIds.includes(tableId(t)))];
    
    if (axis === 'h') {
      selectedTables.sort((a, b) => tablePosition(a).x - tablePosition(b).x);
      const minX = tablePosition(selectedTables[0]).x;
      const maxX = tablePosition(selectedTables[selectedTables.length - 1]).x;
      const step = (maxX - minX) / (selectedTables.length - 1);
      onBulkUpdate(selectedTables.map((t, i) => ({ table: t, x: minX + i * step, y: tablePosition(t).y })));
    } else {
      selectedTables.sort((a, b) => tablePosition(a).y - tablePosition(b).y);
      const minY = tablePosition(selectedTables[0]).y;
      const maxY = tablePosition(selectedTables[selectedTables.length - 1]).y;
      const step = (maxY - minY) / (selectedTables.length - 1);
      onBulkUpdate(selectedTables.map((t, i) => ({ table: t, x: tablePosition(t).x, y: minY + i * step })));
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full min-h-[500px]">
      {/* Visual Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-[var(--bg-glass)] border border-[var(--border-light)] rounded-[var(--radius-md)] mb-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => s * 1.2)} className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] flex items-center justify-center hover:bg-[rgba(255,255,255,0.1)] transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]" title="Zoom In"><ZoomIn size={16} /></button>
          <button onClick={() => setScale(s => s / 1.2)} className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] flex items-center justify-center hover:bg-[rgba(255,255,255,0.1)] transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]" title="Zoom Out"><ZoomOut size={16} /></button>
          <button onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] flex items-center justify-center hover:bg-[rgba(255,255,255,0.1)] transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]" title="Reset View"><Maximize size={16} /></button>
        </div>

        {isAdmin && selectedIds.length > 1 && (
          <div className="flex items-center gap-2 animate-slide-up">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mr-2">{selectedIds.length} SELECCIONADOS:</span>
            <button onClick={() => alignSelection('left')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-all text-xs font-bold border border-blue-500/20"><AlignLeft size={14} /> Alineación lzquierda</button>
            <button onClick={() => alignSelection('top')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-all text-xs font-bold border border-blue-500/20"><AlignTop size={14} /> Alineación Superior</button>
            <button onClick={() => distributeSelection('h')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-all text-xs font-bold border border-indigo-500/20"><LayoutGrid size={14} /> Distribuir H</button>
            <button onClick={() => distributeSelection('v')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-all text-xs font-bold border border-indigo-500/20"><LayoutGrid size={14} className="rotate-90" /> Distribuir V</button>
            <button onClick={() => setSelectedIds([])} className="text-slate-500 hover:text-white px-2">X</button>
          </div>
        )}
      </div>

      <div 
        ref={containerRef} 
        className="flex-grow bg-[rgba(0,0,0,0.2)] rounded-2xl overflow-hidden border border-[var(--border-light)] relative cursor-crosshair"
      >
        <Stage 
          ref={stageRef}
          width={stageSize.width} 
          height={stageSize.height} 
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          draggable={!selectionBox && (!isAdmin || selectedIds.length === 0)}
          onDragEnd={e => {
            if (e.target === stageRef.current) {
              setPosition({ x: e.target.x(), y: e.target.y() });
            }
          }}
        >
          <Layer>
            {/* Stage defaults/grid can be added here if needed */}
            <Rect x={width / 2 - 150} y={20} width={300} height={40} fill="rgba(255,255,255,0.05)" cornerRadius={4} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
            <Text text="ESCENARIO PRINCIPAL" x={width / 2 - 150} y={32} width={300} align="center" fontSize={10} fill="rgba(255,255,255,0.3)" fontStyle="bold" letterSpacing={3} />
            
            {tables.map(table => {
              const tid = tableId(table);
              const available = getAvailable(table);
              const occupied = getOccupied(table);
              const capacity = table.capacity || 0;
              const isFull = available <= 0;
              
              const codeUpper = (table.code || '').toUpperCase();
              let category = 'table';
              if (codeUpper.includes('TARIMA')) category = 'stage';
              if (codeUpper.includes('PISTA')) category = 'dancefloor';
              if (codeUpper.includes('ENTRADA')) category = 'entrance';
              if (codeUpper.includes('SALIDA')) category = 'exit';
              
              const isSelectedForEdit = isAdmin && selectedIds.includes(tid);
              const spotsSelectedByUser = selectedSpots[tid] || 0;
              const isSelectedByUser = spotsSelectedByUser > 0;
              
              // Base colors setup based on semaphore (available spots vs capacity)
              let baseColor = isFull ? 'rgba(239, 68, 68, 0.2)' : occupied > 0 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)';
              let borderColor = isFull ? 'rgba(239, 68, 68, 0.6)' : occupied > 0 ? 'rgba(234, 179, 8, 0.6)' : 'rgba(34, 197, 94, 0.6)';

              // User selection overrides
              if (!isAdmin && isSelectedByUser) {
                 baseColor = 'rgba(57, 255, 20, 0.25)';
                 borderColor = 'var(--accent-primary)';
              }

              if (category === 'stage') { baseColor = 'rgba(56, 189, 248, 0.15)'; borderColor = 'rgba(56, 189, 248, 0.4)'; }
              else if (category === 'dancefloor') { baseColor = 'rgba(255, 255, 255, 0.05)'; borderColor = 'rgba(255, 255, 255, 0.2)'; }
              else if (category === 'exit' || category === 'entrance') { baseColor = 'rgba(244, 63, 94, 0.1)'; borderColor = 'rgba(244, 63, 94, 0.4)'; }
              
              const isDecoration = ['stage', 'dancefloor', 'entrance', 'exit'].includes(category);
              const pos = tablePosition(table);

              return (
                <Group
                  key={tid}
                  id={`table-${tid}`}
                  x={pos.x}
                  y={pos.y}
                  draggable={isAdmin}
                  onDragStart={() => {
                    if (isAdmin && !selectedIds.includes(tid)) {
                      setSelectedIds([tid]);
                    }
                  }}
                  onClick={(e) => {
                    if (!isAdmin) {
                      if (!isDecoration && onTableClick) onTableClick(table);
                      return;
                    }
                    if (e.evt.shiftKey) {
                      setSelectedIds(prev => prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]);
                    } else {
                      setSelectedIds([tid]);
                      if (onTableClick) onTableClick(table);
                    }
                  }}
                  onTap={() => {
                    if (!isAdmin) {
                      if (!isDecoration && onTableClick) onTableClick(table);
                      return;
                    }
                    setSelectedIds([tid]);
                    if (onTableClick) onTableClick(table);
                  }}
                  onDragEnd={(e) => {
                    if (isAdmin && onTableMove) {
                      onTableMove(table, e.target.x(), e.target.y());
                    }
                  }}
                >
                  {category === 'stage' ? (
                    <Rect width={200} height={80} x={-100} y={-40} fill={baseColor} stroke={borderColor} strokeWidth={isSelectedForEdit ? 2 : 1} cornerRadius={4} />
                  ) : category === 'dancefloor' ? (
                    <Rect width={250} height={300} x={-125} y={-150} fill={baseColor} stroke={borderColor} strokeWidth={isSelectedForEdit ? 2 : 1} dash={[5, 5]} />
                  ) : category === 'entrance' || category === 'exit' ? (
                    <Rect width={60} height={15} x={-30} y={-7.5} fill={isSelectedForEdit ? '#fff' : borderColor} />
                  ) : (
                    <Circle radius={30} fill={baseColor} stroke={isSelectedForEdit ? '#fff' : borderColor} strokeWidth={2} shadowColor={borderColor} shadowBlur={15} shadowOpacity={0.4} />
                  )}
                  
                  <Text
                    text={table.code}
                    fontSize={isDecoration ? 8 : 12}
                    fontStyle="bold"
                    fill={isDecoration ? borderColor : "#fff"}
                    align="center"
                    verticalAlign="middle"
                    width={category === 'stage' ? 200 : category === 'dancefloor' ? 250 : 60}
                    x={category === 'stage' ? -100 : category === 'dancefloor' ? -125 : -30}
                    y={isDecoration ? 0 : -12}
                    listening={false}
                  />
                  {!isDecoration && (
                    <Text
                      text={`${available}/${capacity}`}
                      fontSize={10}
                      fill="rgba(255,255,255,0.6)"
                      align="center"
                      width={60}
                      x={-30}
                      y={6}
                      listening={false}
                    />
                  )}
                  {!isAdmin && spotsSelectedByUser > 0 && !isDecoration && (
                    <Circle radius={10} fill="var(--accent-primary)" x={20} y={-20} listening={false} />
                  )}
                  {!isAdmin && spotsSelectedByUser > 0 && !isDecoration && (
                    <Text text={`${spotsSelectedByUser}`} fontSize={10} fill="#000" fontStyle="bold" x={10} y={-25} width={20} align="center" listening={false} />
                  )}
                </Group>
              );
            })}

            {isAdmin && <Transformer ref={trRef} keepRatio={true} enabledAnchors={[]} rotateEnabled={false} borderStroke="#3b82f6" borderStrokeWidth={2} anchorFill="#3b82f6" />}
            
            {selectionBox && (
              <Rect
                x={Math.min(selectionBox.x1, selectionBox.x2)}
                y={Math.min(selectionBox.y1, selectionBox.y2)}
                width={Math.abs(selectionBox.x2 - selectionBox.x1)}
                height={Math.abs(selectionBox.y2 - selectionBox.y1)}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 2]}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};
