import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Circle, Rect, Text, Group, Transformer, Image } from 'react-konva';
import useImage from 'use-image';
import type { MapTable } from '../../api/types';
import { LayoutGrid, AlignLeft, AlignVerticalJustifyStart as AlignTop } from 'lucide-react';

interface EventMapProps {
  tables: MapTable[];
  onTableClick?: (table: MapTable) => void;
  isAdmin?: boolean;
  onTableMove?: (table: MapTable, x: number, y: number) => void;
  onBulkUpdate?: (updates: { table: MapTable; x: number; y: number }[]) => void;
  width?: number;
  height?: number;
  selectedSpots?: Record<string, number>; // How many spots user has selected for each table
  backgroundImageUrl?: string;
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
  selectedSpots = {},
  backgroundImageUrl
}) => {
  const [bgImage] = useImage(backgroundImageUrl || '');
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<any>(null);
  
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const safeStageWidth = Math.max(1, Math.round(stageSize.width));
  const hasValidBackgroundImage = Boolean(bgImage && bgImage.width > 0 && bgImage.height > 0);
  const targetHeightFromImage = hasValidBackgroundImage && bgImage
    ? Math.round(safeStageWidth * (bgImage.height / bgImage.width))
    : 700;
  const mapCanvasHeight = Math.max(520, Math.min(900, targetHeightFromImage));
  const layoutWidth = width;
  const layoutHeight = hasValidBackgroundImage && bgImage
    ? bgImage.height * (layoutWidth / bgImage.width)
    : 700;
  const fitScale = Math.min(safeStageWidth / layoutWidth, mapCanvasHeight / layoutHeight);
  const contentWidth = layoutWidth * fitScale;
  const contentHeight = layoutHeight * fitScale;
  const contentOffsetX = (safeStageWidth - contentWidth) / 2;
  const contentOffsetY = (mapCanvasHeight - contentHeight) / 2;
  const toLayoutX = (screenX: number) => Math.max(0, Math.min(layoutWidth, (screenX - contentOffsetX) / fitScale));
  const toLayoutY = (screenY: number) => Math.max(0, Math.min(layoutHeight, (screenY - contentOffsetY) / fitScale));

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

  const handleMouseDown = (e: any) => {
    // If clicked on stage background
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.getType() === 'Image';
    if (clickedOnEmpty) {
      if (!isAdmin) return;
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      const scaledPos = {
        x: toLayoutX(pos.x),
        y: toLayoutY(pos.y),
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
      x: toLayoutX(pos.x),
      y: toLayoutY(pos.y),
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
    <div className="flex flex-col gap-3 w-full min-h-[560px]">
      {isAdmin && selectedIds.length > 1 && (
        <div className="flex items-center gap-2 animate-slide-up p-2 bg-[var(--bg-glass)] border border-[var(--border-light)] rounded-[var(--radius-md)]">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mr-2">{selectedIds.length} SELECCIONADOS:</span>
          <button onClick={() => alignSelection('left')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-all text-xs font-bold border border-blue-500/20"><AlignLeft size={14} /> Alinear Izquierda</button>
          <button onClick={() => alignSelection('top')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-all text-xs font-bold border border-blue-500/20"><AlignTop size={14} /> Alinear Arriba</button>
          <button onClick={() => distributeSelection('h')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-all text-xs font-bold border border-indigo-500/20"><LayoutGrid size={14} /> Distribuir H</button>
          <button onClick={() => distributeSelection('v')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-all text-xs font-bold border border-indigo-500/20"><LayoutGrid size={14} className="rotate-90" /> Distribuir V</button>
          <button onClick={() => setSelectedIds([])} className="text-slate-500 hover:text-white px-2">X</button>
        </div>
      )}

      <div 
        ref={containerRef} 
        className="bg-[rgba(0,0,0,0.2)] rounded-2xl overflow-hidden border border-[var(--border-light)] relative cursor-crosshair min-h-[560px]"
        style={{ height: `${mapCanvasHeight}px` }}
      >
        <Stage 
          ref={stageRef}
          width={safeStageWidth} 
          height={mapCanvasHeight} 
          scaleX={1}
          scaleY={1}
          x={0}
          y={0}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          draggable={false}
        >
          <Layer>
            <Group x={contentOffsetX} y={contentOffsetY} scaleX={fitScale} scaleY={fitScale}>
              {/* Background Image */}
              {hasValidBackgroundImage && bgImage && (
                <Image 
                  image={bgImage} 
                  x={0} 
                  y={0} 
                  width={layoutWidth}
                  height={layoutHeight}
                  listening={false}
                />
              )}
              {!hasValidBackgroundImage && (
                <Rect
                  x={0}
                  y={0}
                  width={layoutWidth}
                  height={layoutHeight}
                  fill="rgba(255,255,255,0.03)"
                  stroke="rgba(255,255,255,0.12)"
                />
              )}
              {/* Stage defaults/grid can be added here if needed */}
              <Rect x={layoutWidth / 2 - 150} y={20} width={300} height={40} fill="rgba(255,255,255,0.05)" cornerRadius={4} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
              <Text text="ESCENARIO PRINCIPAL" x={layoutWidth / 2 - 150} y={32} width={300} align="center" fontSize={10} fill="rgba(255,255,255,0.3)" fontStyle="bold" letterSpacing={3} />
              
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
            </Group>
          </Layer>
        </Stage>
      </div>
    </div>
  );
};
