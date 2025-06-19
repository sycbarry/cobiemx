"use client";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useFileUpload } from "./FileUploadContext";
import * as XLSX from "xlsx";
import { DataGrid } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import { buildCobieHierarchy, buildCobieSystemHierarchy, buildCobieGraphHierarchy } from "./cobieHierarchy";
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider, Handle, Position } from "reactflow";
import "reactflow/dist/style.css";
import { useRouter } from "next/navigation";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";

function HierarchyTree({ hierarchy }: { hierarchy: any }) {
  if (!hierarchy || hierarchy.error) return <div className="text-red-600">{hierarchy?.error || "No hierarchy data"}</div>;
  if (hierarchy.facilities) {
    return (
      <div className="text-sm">
        {hierarchy.facilities.map((fac: any) => (
          <div key={fac.Name} className="mb-4">
            <div className="font-semibold text-blue-700">🏢 {fac.Name}</div>
            {fac.floors.map((floor: any) => (
              <div key={floor.Name} className="ml-4 mb-2">
                <div className="font-medium text-blue-500">🟦 {floor.Name}</div>
                {floor.spaces && floor.spaces.length > 0 && (
                  <ul className="ml-4 list-disc text-gray-700">
                    {floor.spaces.map((space: any, idx: number) => (
                      <li key={idx}>📄 {space[0] || space.Name || `Space ${idx+1}`}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (hierarchy.systems) {
    return (
      <div className="text-sm">
        {hierarchy.systems.map((sys: any) => (
          <div key={sys.Name} className="mb-4">
            <div className="font-semibold text-green-700">🛠️ {sys.Name}</div>
            {sys.components.map((comp: any) => (
              <div key={comp.Name} className="ml-4 mb-2">
                <div className="font-medium text-green-500">🔩 {comp.Name}</div>
                {comp.assemblies && comp.assemblies.length > 0 && (
                  <ul className="ml-4 list-disc text-gray-700">
                    {comp.assemblies.map((asm: any, idx: number) => (
                      <li key={idx}>⚙️ {asm[0] || asm.Name || `Assembly ${idx+1}`}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return <div>No hierarchy data</div>;
}

function GraphNode({ data }: any) {
  return (
    <div className="rounded shadow bg-white border px-4 py-2 text-xs max-w-xs cursor-pointer">
      <div className="font-bold text-blue-700 truncate">{data.label}</div>
      {data.hovered && (
        <div className="mt-2 p-2 bg-gray-50 border rounded text-gray-700 text-xs">
          {Object.entries(data.meta).map(([k, v]) => (
            <div key={k}><span className="font-semibold text-gray-600">{k}:</span> {String(v)}</div>
          ))}
        </div>
      )}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// Define nodeTypes outside the component to avoid React Flow warning
const nodeTypes = { default: GraphNode };

// Drilldown tree for System > Assembly > Subassembly > Component (with single expanded state)
function SystemDrilldownTree({ hierarchy }: { hierarchy: any }) {
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});

  const toggle = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (!hierarchy || !hierarchy.systems) return <div className="text-red-600">No system hierarchy data</div>;

  // Flatten all assemblies for easier lookup
  const allAssemblies: any[] = [];
  hierarchy.systems.forEach((sys: any) => {
    sys.components.forEach((comp: any) => {
      if (comp.assemblies) {
        comp.assemblies.forEach((asm: any) => {
          allAssemblies.push({ ...asm, ComponentName: comp.Name });
        });
      }
    });
  });

  // Helper to recursively render assemblies and subassemblies
  function renderAssemblies(assemblies: any[], allAssemblies: any[], level = 0, parentId = '') {
    return (
      <ul className={level === 0 ? "ml-2" : "ml-6"}>
        {assemblies.map((asm: any, idx: number) => {
          const id = `${parentId}asm-${asm.Name}-${idx}`;
          // Find subassemblies: assemblies whose ParentName is this assembly's Name
          const subassemblies = allAssemblies.filter((a: any) => a.ParentName === asm.Name && a.ComponentName !== asm.ComponentName);
          // Find components: assemblies whose ParentName is this assembly's Name and have a ChildName that is a component
          const components = allAssemblies.filter((a: any) => a.ParentName === asm.Name && a.ComponentName === asm.ComponentName && a.ChildName);
          return (
            <li key={`${asm.Name}-${idx}`} className="mb-2">
              <div
                className="flex items-center gap-2 cursor-pointer group py-1 px-1 rounded hover:bg-yellow-50 transition"
                onClick={() => toggle(id)}
                style={{ minWidth: 120 }}
              >
                <span className="text-lg select-none transition-transform" style={{ display: 'inline-block', transform: expanded[id] ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  ▶
                </span>
                <span className="font-semibold text-yellow-700 text-base">{asm.Name}</span>
                {subassemblies.length > 0 && <span className="text-xs text-orange-500 ml-1">({subassemblies.length} subassemblies)</span>}
                {components.length > 0 && <span className="text-xs text-purple-500 ml-1">({components.length} components)</span>}
              </div>
              {expanded[id] && (
                <div className="ml-6 border-l border-yellow-100 pl-3 mt-1">
                  {subassemblies.length > 0 && (
                    <div className="mb-1">
                      <div className="text-xs text-orange-600 font-bold mb-1">Subassemblies:</div>
                      {renderAssemblies(subassemblies, allAssemblies, level + 1, id + '-')}
                    </div>
                  )}
                  {components.length > 0 && (
                    <div className="mb-1">
                      <div className="text-xs text-purple-700 font-bold mb-1">Components:</div>
                      <ul>
                        {components.map((comp: any, cidx: number) => (
                          <li key={`${comp.ChildName}-${cidx}`} className="text-purple-700 ml-2 py-0.5">{comp.ChildName}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  // Helper to render components directly under a system
  function renderComponents(components: any[], parentId = '') {
    return (
      <ul className="ml-4">
        {components.map((comp: any, idx: number) => (
          <li key={`${comp.Name}-${idx}`} className="text-purple-700 mb-1 py-0.5 pl-1 hover:bg-purple-50 rounded transition">{comp.Name}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="text-base font-sans">
      {hierarchy.systems.map((sys: any, idx: number) => {
        const id = `sys-${sys.Name}-${idx}`;
        // Top-level assemblies for this system
        const assemblies: any[] = [];
        sys.components.forEach((comp: any) => {
          if (comp.assemblies) {
            comp.assemblies.forEach((asm: any) => {
              // Only top-level assemblies (no parent in this list)
              if (!allAssemblies.some(a => a.ChildName === asm.Name)) {
                assemblies.push({ ...asm, ComponentName: comp.Name });
              }
            });
          }
        });
        return (
          <div key={`${sys.Name}-${idx}`} className="mb-6">
            <div
              className="flex items-center gap-2 cursor-pointer group py-2 px-2 rounded-lg hover:bg-blue-50 transition"
              onClick={() => toggle(id)}
              style={{ minWidth: 180 }}
            >
              <span className="text-xl select-none transition-transform" style={{ display: 'inline-block', transform: expanded[id] ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
              <span className="font-extrabold text-green-700 text-lg tracking-tight">{sys.Name}</span>
              {assemblies.length > 0 && <span className="text-xs text-yellow-600 ml-2">({assemblies.length} assemblies)</span>}
              {assemblies.length === 0 && sys.components.length > 0 && <span className="text-xs text-purple-600 ml-2">({sys.components.length} components)</span>}
            </div>
            {expanded[id] && (
              <div className="ml-7 border-l-2 border-blue-100 pl-4 mt-2">
                {assemblies.length > 0
                  ? renderAssemblies(assemblies, allAssemblies, 0, id + '-')
                  : sys.components.length > 0
                    ? renderComponents(sys.components, id + '-')
                    : <div className="text-gray-400 text-sm ml-2">No assemblies or components</div>
                }
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SpreadsheetPage() {
  const { file } = useFileUpload();
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [columns, setColumns] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [allSheets, setAllSheets] = useState<any>({});
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [hierarchyType, setHierarchyType] = useState<'facility' | 'system' | 'graph'>('facility');
  // Sheet selection for hierarchy
  const [facilityTab, setFacilityTab] = useState('Facility');
  const [floorTab, setFloorTab] = useState('Floor');
  const [spaceTab, setSpaceTab] = useState('Space');
  const [systemTab, setSystemTab] = useState('System');
  const [componentTab, setComponentTab] = useState('Component');
  const [assemblyTab, setAssemblyTab] = useState('Assembly');
  // For graph node hover
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [modalWidth, setModalWidth] = useState<number>(1200);
  const [modalHeight, setModalHeight] = useState<number>(600);
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // System filter state for the graph
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [selectedAssemblies, setSelectedAssemblies] = useState<string[]>([]);
  const [selectedSubassemblies, setSelectedSubassemblies] = useState<string[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // Update modal width on window resize
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setModalWidth(Math.min(window.innerWidth, 1800));
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      // Set initial width on mount
      setModalWidth(Math.min(window.innerWidth, 1800));
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  // Update modal height on window resize
  useEffect(() => {
    const handleResize = () => {
      setModalHeight(Math.max(400, Math.min(window.innerHeight - 100, 800)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!file) {
      router.replace("/");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setSelectedSheet(wb.SheetNames[0]);
        // Parse all sheets for hierarchy
        const all: any = {};
        wb.SheetNames.forEach((name) => {
          all[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
        });
        setAllSheets(all);
      } catch (err: any) {
        setError("Failed to parse file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [file]);

  useEffect(() => {
    if (!workbook || !selectedSheet) return;
    try {
      const worksheet = workbook.Sheets[selectedSheet];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (!Array.isArray(json) || json.length === 0) throw new Error("Sheet is empty");
      const [headerRaw, ...bodyRaw] = json;
      if (!Array.isArray(headerRaw)) throw new Error("Header row is not an array");
      setColumns(headerRaw.map((h: string, idx: number) => ({ key: String(idx), name: h || `Column ${idx+1}` })));
      setRows(bodyRaw.map((row) => {
        if (!Array.isArray(row)) return {};
        const obj: any = {};
        headerRaw.forEach((h: string, idx: number) => { obj[String(idx)] = row[idx] ?? ""; });
        return obj;
      }));
      setError(null);
    } catch (err: any) {
      setError("Failed to parse sheet: " + err.message);
    }
  }, [workbook, selectedSheet]);

  useEffect(() => {
    if (
      hierarchyType === 'graph' &&
      hierarchy &&
      typeof hierarchy === 'object' &&
      'nodes' in hierarchy &&
      'edges' in hierarchy
    ) {
      // Log the graph data for debugging
      // eslint-disable-next-line no-console
      console.log('Graph Nodes:', hierarchy.nodes);
      // eslint-disable-next-line no-console
      console.log('Graph Edges:', hierarchy.edges);
    }
  }, [hierarchyType, hierarchy]);

  const openHierarchy = () => {
    let hierarchyResult;
    if (hierarchyType === 'facility') {
      hierarchyResult = buildCobieHierarchy({
        [facilityTab]: allSheets[facilityTab],
        [floorTab]: allSheets[floorTab],
        [spaceTab]: allSheets[spaceTab],
      });
    } else if (hierarchyType === 'system') {
      hierarchyResult = buildCobieSystemHierarchy({
        [systemTab]: allSheets[systemTab],
        [componentTab]: allSheets[componentTab],
        [assemblyTab]: allSheets[assemblyTab],
      });
    } else {
      hierarchyResult = buildCobieGraphHierarchy({
        [systemTab]: allSheets[systemTab],
        [componentTab]: allSheets[componentTab],
        [assemblyTab]: allSheets[assemblyTab],
        [facilityTab]: allSheets[facilityTab],
        [floorTab]: allSheets[floorTab],
        [spaceTab]: allSheets[spaceTab],
        Component: allSheets[componentTab],
        Assembly: allSheets[assemblyTab],
      });
      // Log the graph data for debugging
      if (hierarchyResult && typeof hierarchyResult === 'object' && 'nodes' in hierarchyResult && 'edges' in hierarchyResult) {
        // eslint-disable-next-line no-console
        console.log('Graph Nodes (on open):', hierarchyResult.nodes);
        // eslint-disable-next-line no-console
        console.log('Graph Edges (on open):', hierarchyResult.edges);
      }
    }
    setHierarchy(hierarchyResult);
    setShowHierarchy(true);
  };

  // Build React Flow nodes/edges for graph hierarchy
  const graphElements = useMemo(() => {
    if (!hierarchy || !hierarchy.systems) return { nodes: [], edges: [] };
    let nodes: any[] = [];
    let edges: any[] = [];
    hierarchy.systems.forEach((sys: any) => {
      nodes.push({ id: `sys-${sys.Name}`, type: 'default', position: { x: Math.random() * 400, y: Math.random() * 100 }, data: { label: sys.Name, meta: sys, hovered: hoveredNode === `sys-${sys.Name}` } });
      if (sys.assemblies) {
        sys.assemblies.forEach((asm: any) => {
          nodes.push({ id: `asm-${asm.Name}`, type: 'default', position: { x: Math.random() * 400 + 200, y: Math.random() * 100 + 150 }, data: { label: asm.Name, meta: asm, hovered: hoveredNode === `asm-${asm.Name}` } });
          edges.push({ id: `e-sys-${sys.Name}-asm-${asm.Name}`, source: `sys-${sys.Name}`, target: `asm-${asm.Name}` });
          if (asm.components) {
            asm.components.forEach((comp: any) => {
              nodes.push({ id: `comp-${comp.Name}`, type: 'default', position: { x: Math.random() * 400 + 400, y: Math.random() * 100 + 300 }, data: { label: comp.Name, meta: comp, hovered: hoveredNode === `comp-${comp.Name}` } });
              edges.push({ id: `e-asm-${asm.Name}-comp-${comp.Name}`, source: `asm-${asm.Name}`, target: `comp-${comp.Name}` });
            });
          }
        });
      }
    });
    return { nodes, edges };
  }, [hierarchy, hoveredNode]);

  // Convert graphElements to Cytoscape format
  const cyElements = useMemo(() => {
    if (hierarchyType !== 'graph' || !hierarchy || !('nodes' in hierarchy) || !('edges' in hierarchy)) return [];
    const nodes = hierarchy.nodes.map((n: any) => ({
      data: { id: n.id, label: n.data?.Name || n.data?.ParentName || n.data?.ChildName || n.id, ...n.data },
      classes: n.type,
    }));
    const edges = hierarchy.edges.map((e: any) => ({
      data: { id: e.id, source: e.source, target: e.target },
    }));
    return [...nodes, ...edges];
  }, [hierarchy, hierarchyType]);

  // Tooltip state for Cytoscape
  const [cyTooltip, setCyTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // Make all columns resizable
  const resizableColumns = useMemo(() =>
    columns.map(col => ({ ...col, resizable: true })),
    [columns]
  );

  // Get all system names for the filter dropdown
  const allSystemNames = useMemo(() => {
    if (!hierarchy || !('nodes' in hierarchy)) return [];
    return hierarchy.nodes.filter((n: any) => n.type === 'system').map((n: any) => n.data.Name);
  }, [hierarchy]);

  // Get all assembly names
  const allAssemblyNames = useMemo(() => {
    if (!hierarchy || !('nodes' in hierarchy)) return [];
    return hierarchy.nodes.filter((n: any) => n.type === 'assembly').map((n: any) => n.data.Name);
  }, [hierarchy]);

  // Get all subassembly names (assemblies that are children of other assemblies)
  const allSubassemblyNames = useMemo(() => {
    if (!hierarchy || !('edges' in hierarchy)) return [];
    // Find all assembly nodes that are a target of an edge from another assembly
    const assemblyTargets = hierarchy.edges
      .filter((e: any) => e.source.startsWith('asm-') && e.target.startsWith('asm-'))
      .map((e: any) => e.target.replace('asm-', ''));
    return Array.from(new Set(assemblyTargets));
  }, [hierarchy]);

  // Get all component names
  const allComponentNames = useMemo(() => {
    if (!hierarchy || !('nodes' in hierarchy)) return [];
    return hierarchy.nodes.filter((n: any) => n.type === 'component').map((n: any) => n.data.Name);
  }, [hierarchy]);

  // Filtered elements for Cytoscape
  const filteredCyElements = useMemo(() => {
    if (hierarchyType !== 'graph' || !hierarchy || !('nodes' in hierarchy) || !('edges' in hierarchy)) return [];
    // If no filters, show all
    if (!selectedSystem && selectedAssemblies.length === 0 && selectedSubassemblies.length === 0 && !selectedComponent) {
      return cyElements;
    }
    // Build set of node ids to keep
    let nodeIds = new Set<string>();
    let edgeIds = new Set<string>();
    // Helper to add reachable nodes/edges from a starting node
    const addReachable = (startId: string) => {
      const relatedNodeIds = new Set([startId]);
      let foundNew = true;
      while (foundNew) {
        foundNew = false;
        hierarchy.edges.forEach((e: any) => {
          if (relatedNodeIds.has(e.source) && !relatedNodeIds.has(e.target)) {
            relatedNodeIds.add(e.target);
            edgeIds.add(e.id);
            foundNew = true;
          }
        });
      }
      relatedNodeIds.forEach(id => nodeIds.add(id));
    };
    // System filter
    if (selectedSystem) {
      addReachable(`sys-${selectedSystem}`);
    }
    // Assembly filter (multi)
    selectedAssemblies.forEach(name => {
      addReachable(`asm-${name}`);
    });
    // Subassembly filter (multi)
    selectedSubassemblies.forEach(name => {
      addReachable(`asm-${name}`);
    });
    // Component filter (single, isolates just that component and its direct edges)
    if (selectedComponent) {
      nodeIds.add(`comp-${selectedComponent}`);
      hierarchy.edges.forEach((e: any) => {
        if (e.source === `comp-${selectedComponent}` || e.target === `comp-${selectedComponent}`) {
          edgeIds.add(e.id);
          nodeIds.add(e.source);
          nodeIds.add(e.target);
        }
      });
    }
    // Filter nodes and edges
    const nodes = cyElements.filter((el: any) => el.data && nodeIds.has(el.data.id));
    const edges = cyElements.filter((el: any) => el.data && el.data.source && edgeIds.has(el.data.id))
      .map((el: any) => ({ ...el, classes: (el.classes || '') + ' highlighted-edge' }));
    return [...nodes, ...edges];
  }, [cyElements, hierarchy, hierarchyType, selectedSystem, selectedAssemblies, selectedSubassemblies, selectedComponent]);

  // Add a key to force CytoscapeComponent to re-render and re-layout when filter changes
  const cyKey = useMemo(() => `cy-${selectedSystem || ''}-${selectedAssemblies.join(',')}-${selectedSubassemblies.join(',')}-${selectedComponent || ''}`,
    [selectedSystem, selectedAssemblies, selectedSubassemblies, selectedComponent]);

  if (!file) {
    return null;
  }
  if (error) {
    return <div className="text-red-600 p-8 bg-gray-50">{error}</div>;
  }
  return (
    <div className="min-h-screen w-full bg-gray-50 py-10 px-0 font-sans">
      <div className="w-full max-w-[1800px] mx-auto flex flex-col h-[80vh]">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-6 px-8">
          <div>
            <h1 className="text-4xl font-extrabold text-blue-800 mb-2 tracking-tight drop-shadow-sm">COBie Spreadsheet View</h1>
            <p className="text-lg text-gray-500">Upload and explore COBie data in a modern, interactive spreadsheet.</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {/* Segmented control for hierarchy type */}
            <div className="flex gap-0.5 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 mb-2">
              <button
                className={`px-5 py-2 font-semibold text-base transition-colors focus:outline-none ${hierarchyType === 'facility' ? 'bg-blue-600 text-white' : 'bg-transparent text-blue-700 hover:bg-blue-100'}`}
                onClick={() => setHierarchyType('facility')}
              >
                Facility
              </button>
              <button
                className={`px-5 py-2 font-semibold text-base transition-colors focus:outline-none ${hierarchyType === 'system' ? 'bg-green-600 text-white' : 'bg-transparent text-green-700 hover:bg-green-100'}`}
                onClick={() => setHierarchyType('system')}
              >
                System
              </button>
              <button
                className={`px-5 py-2 font-semibold text-base transition-colors focus:outline-none ${hierarchyType === 'graph' ? 'bg-purple-600 text-white' : 'bg-transparent text-purple-700 hover:bg-purple-100'}`}
                onClick={() => setHierarchyType('graph')}
              >
                Graph
              </button>
            </div>
            {/* Sheet selectors for hierarchy */}
            {hierarchyType === 'facility' ? (
              <div className="flex gap-2">
                <select value={facilityTab} onChange={e => setFacilityTab(e.target.value)} className="border rounded px-3 py-1 text-base">
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select value={floorTab} onChange={e => setFloorTab(e.target.value)} className="border rounded px-3 py-1 text-base">
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select value={spaceTab} onChange={e => setSpaceTab(e.target.value)} className="border rounded px-3 py-1 text-base">
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            ) : hierarchyType === 'system' ? (
              <div className="flex gap-2">
                <select value={systemTab} onChange={e => setSystemTab(e.target.value)} className="border rounded px-3 py-1 text-base">
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select value={componentTab} onChange={e => setComponentTab(e.target.value)} className="border rounded px-3 py-1 text-base">
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select value={assemblyTab} onChange={e => setAssemblyTab(e.target.value)} className="border rounded px-3 py-1 text-base">
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={systemTab} onChange={e => setSystemTab(e.target.value)} className="border rounded px-3 py-1 text-base">
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select value={componentTab} onChange={e => setComponentTab(e.target.value)} className="border rounded px-3 py-1 text-base">
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select value={assemblyTab} onChange={e => setAssemblyTab(e.target.value)} className="border rounded px-3 py-1 text-base">
                  {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            )}
            <button
              className="mt-2 px-5 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-colors font-semibold text-base"
              onClick={openHierarchy}
            >
              Show Hierarchy
            </button>
          </div>
        </header>
        <div className="w-full px-8 flex-1 flex flex-col min-h-0">
          <div className="mb-4 border-b border-gray-200">
            <nav className="flex flex-wrap gap-2" aria-label="Tabs">
              {sheetNames.map((name) => (
                <button
                  key={name}
                  className={`px-6 py-2 rounded-t-lg border-b-2 font-semibold text-base focus:outline-none transition-all duration-150
                    ${selectedSheet === name
                      ? "border-blue-600 bg-white text-blue-700 shadow-sm drop-shadow-sm"
                      : "border-transparent bg-gray-100 text-gray-500 hover:bg-white hover:text-blue-600"}
                  `}
                  style={{ minWidth: 140 }}
                  onClick={() => setSelectedSheet(name)}
                >
                  {name}
                </button>
              ))}
            </nav>
          </div>
          <div className="border rounded-2xl shadow-lg overflow-auto bg-white flex-1 min-h-0" style={{ minHeight: 0, width: '100%' }}>
            <div className="w-full h-full" style={{ background: '#fff', borderRadius: 18, boxShadow: '0 4px 16px 0 rgba(0,0,0,0.06)', height: '100%', minWidth: 900 }}>
              <DataGrid
                columns={resizableColumns}
                rows={rows}
                className="rdg-light google-sheets-style"
                style={{
                  minWidth: 1200,
                  fontFamily: 'Inter, Roboto, Arial, sans-serif',
                  fontSize: 15,
                  borderRadius: 18,
                  border: '1.5px solid #e0e7ef',
                  boxShadow: '0 4px 16px 0 rgba(0,0,0,0.06)',
                  height: '100%',
                }}
                rowHeight={36}
                headerRowHeight={40}
              />
            </div>
          </div>
          <style jsx global>{`
            .google-sheets-style .rdg-header-row {
              background: #f8fafc;
              font-weight: 600;
              border-bottom: 2px solid #e0e0e0;
              position: sticky;
              top: 0;
              z-index: 2;
              letter-spacing: 0.01em;
            }
            .google-sheets-style .rdg-row {
              border-bottom: 1px solid #f1f1f1;
              transition: background 0.15s;
            }
            .google-sheets-style .rdg-row:hover {
              background: #f1f5f9;
            }
            .google-sheets-style .rdg-cell {
              border-right: 1px solid #f1f1f1;
              padding: 0 14px;
              background: #fff;
            }
            .google-sheets-style .rdg-cell:last-child {
              border-right: none;
            }
            .google-sheets-style .rdg {
              border-radius: 18px;
              overflow: hidden;
            }
          `}</style>
        </div>
      </div>
      {/* Hierarchy Modal/Side Panel */}
      {showHierarchy && (
        <div className="fixed inset-0 z-50 flex items-end select-none">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/30 transition-opacity" onClick={() => setShowHierarchy(false)} />
          {/* Bottom Modal */}
          <div
            ref={modalRef}
            className="relative w-full bg-white shadow-2xl p-8 animate-slide-in-bottom flex flex-col rounded-t-2xl"
            style={{ height: modalHeight, maxHeight: '90vh', minHeight: 400, margin: 0 }}
          >
            {/* Drag handle */}
            <div
              className="absolute top-0 left-0 w-full flex justify-center cursor-row-resize z-10"
              style={{ height: 24 }}
              onMouseDown={e => {
                setIsDragging(true);
                e.preventDefault();
              }}
            >
              <div className="w-24 h-2 mt-2 bg-gray-300 rounded-full" />
            </div>
            {/* Drag logic */}
            {isDragging && (
              <div
                className="fixed inset-0 z-50"
                style={{ cursor: 'row-resize' }}
                onMouseMove={e => {
                  if (modalRef.current) {
                    const rect = modalRef.current.getBoundingClientRect();
                    const newHeight = window.innerHeight - e.clientY;
                    setModalHeight(Math.max(400, Math.min(newHeight, window.innerHeight - 40)));
                  }
                }}
                onMouseUp={() => setIsDragging(false)}
              />
            )}
            <button
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 text-3xl font-bold"
              onClick={() => setShowHierarchy(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <div className="flex items-center gap-4 mb-6 mt-4">
              <h2 className="text-2xl font-semibold text-blue-700 mb-0">COBie Hierarchy</h2>
            </div>
            {hierarchyType === 'graph' ? (
              <div style={{ width: '100%', height: modalHeight - 120, position: 'relative' }}>
                {/* Toolbox for filtering */}
                <div
                  className="absolute left-0 top-0 z-20 p-5 bg-white/95 border border-gray-200 rounded-2xl shadow-xl"
                  style={{ minWidth: 370, maxWidth: 520, fontFamily: 'Inter, Roboto, Arial, sans-serif', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.14)' }}
                >
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div className="flex flex-col">
                      <label className="font-bold text-blue-700 text-sm mb-1">System</label>
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-2 text-base bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all shadow-sm hover:border-blue-400"
                        value={selectedSystem || ''}
                        onChange={e => setSelectedSystem(e.target.value || null)}
                      >
                        <option value="">All</option>
                        {(allSystemNames as string[]).map((name, idx) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button
                        className="text-xs text-blue-500 underline mt-1 self-end hover:text-blue-700 disabled:text-gray-300"
                        onClick={() => setSelectedSystem(null)}
                        disabled={!selectedSystem}
                      >Clear</button>
                    </div>
                    <div className="flex flex-col">
                      <label className="font-bold text-yellow-700 text-sm mb-1">Assembly</label>
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-2 text-base bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all shadow-sm hover:border-yellow-400"
                        multiple
                        size={Math.min(4, (allAssemblyNames as string[]).length)}
                        value={selectedAssemblies}
                        onChange={e => {
                          const options = Array.from(e.target.selectedOptions).map(opt => opt.value);
                          setSelectedAssemblies(options);
                        }}
                      >
                        {(allAssemblyNames as string[]).map((name, idx) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button
                        className="text-xs text-yellow-600 underline mt-1 self-end hover:text-yellow-800 disabled:text-gray-300"
                        onClick={() => setSelectedAssemblies([])}
                        disabled={selectedAssemblies.length === 0}
                      >Clear</button>
                    </div>
                    <div className="flex flex-col">
                      <label className="font-bold text-orange-700 text-sm mb-1">Subassembly</label>
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-2 text-base bg-white focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all shadow-sm hover:border-orange-400"
                        multiple
                        size={Math.min(4, (allSubassemblyNames as string[]).length)}
                        value={selectedSubassemblies}
                        onChange={e => {
                          const options = Array.from(e.target.selectedOptions).map(opt => opt.value);
                          setSelectedSubassemblies(options);
                        }}
                      >
                        {(allSubassemblyNames as string[]).map((name, idx) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button
                        className="text-xs text-orange-600 underline mt-1 self-end hover:text-orange-800 disabled:text-gray-300"
                        onClick={() => setSelectedSubassemblies([])}
                        disabled={selectedSubassemblies.length === 0}
                      >Clear</button>
                    </div>
                    <div className="flex flex-col">
                      <label className="font-bold text-purple-700 text-sm mb-1">Component</label>
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-2 text-base bg-white focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all shadow-sm hover:border-purple-400"
                        value={selectedComponent || ''}
                        onChange={e => setSelectedComponent(e.target.value || null)}
                      >
                        <option value="">All</option>
                        {(allComponentNames as string[]).map((name, idx) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button
                        className="text-xs text-purple-600 underline mt-1 self-end hover:text-purple-800 disabled:text-gray-300"
                        onClick={() => setSelectedComponent(null)}
                        disabled={!selectedComponent}
                      >Clear</button>
                    </div>
                  </div>
                </div>
                <CytoscapeComponent
                  key={cyKey}
                  elements={filteredCyElements}
                  style={{ width: '100%', height: '100%' }}
                  layout={{ name: 'breadthfirst', directed: true, padding: 100, spacingFactor: 2.5, animate: true, animationDuration: 600 }}
                  stylesheet={[
                    { selector: 'node', style: {
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'color': '#222',
                        'background-color': '#e0e7ff',
                        'border-width': 3,
                        'border-color': '#2563eb',
                        'font-size': 20,
                        'width': 80,
                        'height': 80,
                        'text-wrap': 'wrap',
                        'text-max-width': 70,
                        'box-shadow': '0 4px 16px 0 rgba(0,0,0,0.10)',
                        'z-index': 10,
                        'transition-property': 'background-color, border-color, width, height',
                        'transition-duration': '0.2s',
                      }
                    },
                    { selector: 'node.system', style: {
                        'background-color': '#2563eb',
                        'border-color': '#1e40af',
                        'shape': 'roundrectangle',
                        'font-weight': 'bold',
                        'width': 100,
                        'height': 100,
                        'font-size': 22,
                      }
                    },
                    { selector: 'node.assembly', style: {
                        'background-color': '#fbbf24',
                        'border-color': '#b45309',
                        'shape': 'diamond',
                        'width': 90,
                        'height': 90,
                        'font-size': 18,
                      }
                    },
                    { selector: 'node.component', style: {
                        'background-color': '#a21caf',
                        'border-color': '#581c87',
                        'shape': 'ellipse',
                        'width': 80,
                        'height': 80,
                        'font-size': 16,
                      }
                    },
                    { selector: 'node:hover', style: {
                        'background-color': '#f1f5f9',
                        'border-color': '#6366f1',
                        'width': 110,
                        'height': 110,
                        'font-size': 24,
                        'z-index': 20,
                        'box-shadow': '0 8px 32px 0 rgba(0,0,0,0.18)',
                      }
                    },
                    { selector: 'edge', style: {
                        'width': 4,
                        'line-color': '#a3a3a3',
                        'target-arrow-color': '#a3a3a3',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'arrow-scale': 1.5,
                      }
                    },
                    { selector: 'edge.highlighted-edge', style: {
                        'line-color': '#2563eb',
                        'target-arrow-color': '#2563eb',
                        'width': 6,
                        'z-index': 30,
                      }
                    },
                  ]}
                  cy={(cy: any) => {
                    cy.on('mouseover', 'node', (evt: any) => {
                      const node = evt.target;
                      const pos = node.renderedPosition();
                      setCyTooltip({
                        x: pos.x,
                        y: pos.y,
                        content: Object.entries(node.data()).map(([k, v]) => `<div><b>${k}:</b> ${v}</div>`).join(''),
                      });
                    });
                    cy.on('mouseout', 'node', () => setCyTooltip(null));
                  }}
                />
                {cyTooltip && (
                  <div
                    className="fixed z-50 p-2 bg-white border rounded shadow text-xs"
                    style={{ left: cyTooltip.x + 20, top: cyTooltip.y + 80, pointerEvents: 'none' }}
                    dangerouslySetInnerHTML={{ __html: cyTooltip.content }}
                  />
                )}
              </div>
            ) : hierarchyType === 'system' ? (
              <div style={{ width: '100%', maxHeight: modalHeight - 80, overflow: 'auto', paddingRight: 8 }}>
                <SystemDrilldownTree hierarchy={hierarchy} />
              </div>
            ) : (
              <HierarchyTree hierarchy={hierarchy} />
            )}
          </div>
          <style jsx global>{`
            @keyframes slide-in-bottom {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .animate-slide-in-bottom {
              animation: slide-in-bottom 0.3s cubic-bezier(0.4,0,0.2,1);
            }
          `}</style>
        </div>
      )}
    </div>
  );
} 