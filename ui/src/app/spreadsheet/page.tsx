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
import { FaCog, FaCheckCircle, FaTrash } from "react-icons/fa";
import ReactDOM from 'react-dom';
import HierarchyTree from "./HierarchyTree";
import GraphNode from "./GraphNode";
import SystemDrilldownTree from "./SystemDrilldownTree";
import FilterSection from "./FilterSection";

// Define nodeTypes outside the component to avoid React Flow warning
const nodeTypes = { default: GraphNode };

// Helper to build a location graph from facility hierarchy
function buildLocationGraph(hierarchy: any): { nodes: any[]; edges: any[] } {
  if (!hierarchy || !hierarchy.facilities) return { nodes: [], edges: [] };
  let nodes: any[] = [];
  let edges: any[] = [];
  hierarchy.facilities.forEach((fac: any, fidx: number) => {
    const facId = `fac-${fac.Name || fidx}`;
    nodes.push({ id: facId, data: { label: fac.Name, type: 'facility', ...fac }, type: 'facility' });
    (fac.floors || []).forEach((floor: any, flidx: number) => {
      const floorId = `floor-${floor.Name || flidx}`;
      nodes.push({ id: floorId, data: { label: floor.Name, type: 'floor', ...floor }, type: 'floor' });
      edges.push({ id: `e-${facId}-${floorId}`, source: facId, target: floorId });
      (floor.spaces || []).forEach((space: any, sidx: number) => {
        const spaceId = `space-${space.Name || sidx}`;
        nodes.push({ id: spaceId, data: { label: space.Name, type: 'space', ...space }, type: 'space' });
        edges.push({ id: `e-${floorId}-${spaceId}`, source: floorId, target: spaceId });
        // If zones exist, add them as children of space
        if (space.zones && space.zones.length > 0) {
          space.zones.forEach((zone: any, zidx: number) => {
            const zoneId = `zone-${zone.Name || zidx}`;
            nodes.push({ id: zoneId, data: { label: zone.Name, type: 'zone', ...zone }, type: 'zone' });
            edges.push({ id: `e-${spaceId}-${zoneId}`, source: spaceId, target: zoneId });
            (zone.components || []).forEach((comp: any, cidx: number) => {
              const compId = `comp-${comp.Name || cidx}`;
              nodes.push({ id: compId, data: { label: comp.Name, type: 'component', ...comp }, type: 'component' });
              edges.push({ id: `e-${zoneId}-${compId}`, source: zoneId, target: compId });
            });
          });
        } else {
          // No zones, add components directly under space
          (space.components || []).forEach((comp: any, cidx: number) => {
            const compId = `comp-${comp.Name || cidx}`;
            nodes.push({ id: compId, data: { label: comp.Name, type: 'component', ...comp }, type: 'component' });
            edges.push({ id: `e-${spaceId}-${compId}`, source: spaceId, target: compId });
          });
        }
      });
    });
  });
  return { nodes, edges };
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
  const [modalHeight, setModalHeight] = useState<number>(850);
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // System filter state for the graph
  const [selectedSystem, setSelectedSystem] = useState<string[]>([]);
  const [selectedAssemblies, setSelectedAssemblies] = useState<string[]>([]);
  const [selectedSubassemblies, setSelectedSubassemblies] = useState<string[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string[]>([]);
  // Sidebar state
  const [showSidebar, setShowSidebar] = useState(false);
  // DB2 connection form state
  const [db2Settings, setDb2Settings] = useState({
    id: '',
    name: '',
    hostname: '',
    port: '',
    database: '',
    username: '',
    password: '',
  });
  const [db2Connecting, setDb2Connecting] = useState(false);
  const [db2Error, setDb2Error] = useState<string | null>(null);
  const [db2Connected, setDb2Connected] = useState(false);
  // Add modal state
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  // Remove hardcoded maximoConnections, use state instead
  const [connections, setConnections] = useState<any[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  // Add tab state
  const [activeTab, setActiveTab] = useState<'cobie' | 'maximo'>('cobie');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  // Add state for SQL input and query results
  const [sqlInput, setSqlInput] = useState('SELECT * FROM asset FETCH FIRST 10 ROWS ONLY;');
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryVisibility, setQueryVisibility] = useState<{ [key: string]: boolean }>({});
  // Draggable toolbox state
  const [cobiePos, setCobiePos] = useState({ x: 24, y: 24 });
  const cobieRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'cobie' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  // Add state for loading
  const [showHierarchyLoading, setShowHierarchyLoading] = useState(false);
  // Add state for showing dropdowns
  const [showSystemDropdown, setShowSystemDropdown] = useState(false);
  const [showAssemblyDropdown, setShowAssemblyDropdown] = useState(false);
  const [showSubassemblyDropdown, setShowSubassemblyDropdown] = useState(false);
  const [showComponentDropdown, setShowComponentDropdown] = useState(false);
  // Add refs for each button
  const systemBtnRef = useRef<HTMLButtonElement | null>(null);
  const assemblyBtnRef = useRef<HTMLButtonElement | null>(null);
  const subassemblyBtnRef = useRef<HTMLButtonElement | null>(null);
  const componentBtnRef = useRef<HTMLButtonElement | null>(null);
  // Add pending selection state for each control
  const [pendingSystem, setPendingSystem] = useState<string[]>(selectedSystem);
  const [pendingAssemblies, setPendingAssemblies] = useState(selectedAssemblies);
  const [pendingSubassemblies, setPendingSubassemblies] = useState(selectedSubassemblies);
  const [pendingComponent, setPendingComponent] = useState(selectedComponent);
  // Sync pending state with actual state when popouts open/close
  useEffect(() => { setPendingSystem(selectedSystem); }, [showSystemDropdown]);
  useEffect(() => { setPendingAssemblies(selectedAssemblies); }, [showAssemblyDropdown]);
  useEffect(() => { setPendingSubassemblies(selectedSubassemblies); }, [showSubassemblyDropdown]);
  useEffect(() => { setPendingComponent(selectedComponent); }, [showComponentDropdown]);
  // Add search state hooks near other state hooks:
  const [systemSearch, setSystemSearch] = useState("");
  const [assemblySearch, setAssemblySearch] = useState("");
  const [subassemblySearch, setSubassemblySearch] = useState("");
  const [componentSearch, setComponentSearch] = useState("");
  // Add state for selected component node
  const [selectedComponentNode, setSelectedComponentNode] = useState<any>(null);
  const [isolatedNodeId, setIsolatedNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string | null; nodeData?: any; nodeType?: string } | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<any>(null);
  // Add state for graph mode (system/location)
  const [graphMode, setGraphMode] = useState<'system' | 'location'>('system');
  // Add state for location graph filtering
  const [selectedFacility, setSelectedFacility] = useState<string[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string[]>([]);
  // Pending state for popouts
  const [pendingFacility, setPendingFacility] = useState<string[]>([]);
  const [pendingFloor, setPendingFloor] = useState<string[]>([]);
  const [pendingSpace, setPendingSpace] = useState<string[]>([]);
  const [pendingZone, setPendingZone] = useState<string[]>([]);
  // Popout open state
  const [showFacilityDropdown, setShowFacilityDropdown] = useState(false);
  const [showFloorDropdown, setShowFloorDropdown] = useState(false);
  const [showSpaceDropdown, setShowSpaceDropdown] = useState(false);
  const [showZoneDropdown, setShowZoneDropdown] = useState(false);
  // Refs for popouts
  const facilityBtnRef = useRef<HTMLButtonElement | null>(null);
  const floorBtnRef = useRef<HTMLButtonElement | null>(null);
  const spaceBtnRef = useRef<HTMLButtonElement | null>(null);
  const zoneBtnRef = useRef<HTMLButtonElement | null>(null);
  // Sync pending state with actual state when popouts open/close
  useEffect(() => { setPendingFacility(selectedFacility); }, [showFacilityDropdown]);
  useEffect(() => { setPendingFloor(selectedFloor); }, [showFloorDropdown]);
  useEffect(() => { setPendingSpace(selectedSpace); }, [showSpaceDropdown]);
  useEffect(() => { setPendingZone(selectedZone); }, [showZoneDropdown]);

  // Extract unique names for dropdowns from loaded COBie data
  const facilityNames = useMemo(() => {
    const sheet = allSheets[facilityTab];
    if (!sheet || sheet.length < 2) return [];
    const header = sheet[0];
    const nameIdx = header.indexOf("Name");
    return sheet.slice(1).map((row: any) => row[nameIdx]).filter(Boolean);
  }, [allSheets, facilityTab]);
  const floorNames = useMemo(() => {
    const sheet = allSheets[floorTab];
    if (!sheet || sheet.length < 2) return [];
    const header = sheet[0];
    const nameIdx = header.indexOf("Name");
    return sheet.slice(1).map((row: any) => row[nameIdx]).filter(Boolean);
  }, [allSheets, floorTab]);
  const spaceNames = useMemo(() => {
    const sheet = allSheets[spaceTab];
    if (!sheet || sheet.length < 2) return [];
    const header = sheet[0];
    const nameIdx = header.indexOf("Name");
    return sheet.slice(1).map((row: any) => row[nameIdx]).filter(Boolean);
  }, [allSheets, spaceTab]);
  const zoneNames = useMemo(() => {
    const sheet = allSheets["Zone"];
    if (!sheet || sheet.length < 2) return [];
    const header = sheet[0];
    const nameIdx = header.indexOf("Name");
    return sheet.slice(1).map((row: any) => row[nameIdx]).filter(Boolean);
  }, [allSheets]);

  // Helper to filter the location hierarchy by selected values
  function filterLocationHierarchy(hierarchy: any): any {
    if (!hierarchy || !hierarchy.facilities) return hierarchy;
    let facilities = hierarchy.facilities;
    if (selectedFacility.length > 0) {
      facilities = facilities.filter((f: any) => selectedFacility.includes(f.Name));
    }
    facilities = facilities.map((f: any) => {
      let floors = f.floors || [];
      if (selectedFloor.length > 0) floors = floors.filter((fl: any) => selectedFloor.includes(fl.Name));
      floors = floors.map((fl: any) => {
        let spaces = fl.spaces || [];
        if (selectedSpace.length > 0) spaces = spaces.filter((sp: any) => selectedSpace.includes(sp.Name));
        spaces = spaces.map((sp: any) => {
          let zones = sp.zones || [];
          if (selectedZone.length > 0) zones = zones.filter((z: any) => selectedZone.includes(z.Name));
          return { ...sp, zones };
        });
        return { ...fl, spaces };
      });
      return { ...f, floors };
    });
    return { ...hierarchy, facilities };
  }

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
    setShowHierarchyLoading(true);
    setTimeout(() => {
      let hierarchyResult;
      if (hierarchyType === 'facility') {
        hierarchyResult = buildCobieHierarchy({
          [facilityTab]: allSheets[facilityTab],
          [floorTab]: allSheets[floorTab],
          [spaceTab]: allSheets[spaceTab],
          Component: allSheets[componentTab],
        });
      } else if (hierarchyType === 'system') {
        hierarchyResult = buildCobieSystemHierarchy({
          [systemTab]: allSheets[systemTab],
          [componentTab]: allSheets[componentTab],
          [assemblyTab]: allSheets[assemblyTab],
        });
      } else {
        // Always build both hierarchies for graph mode
        const systemGraph = buildCobieGraphHierarchy({
          [systemTab]: allSheets[systemTab],
          [componentTab]: allSheets[componentTab],
          [assemblyTab]: allSheets[assemblyTab],
          [facilityTab]: allSheets[facilityTab],
          [floorTab]: allSheets[floorTab],
          [spaceTab]: allSheets[spaceTab],
          Component: allSheets[componentTab],
          Assembly: allSheets[assemblyTab],
        });
        const locationHierarchy = buildCobieHierarchy({
          [facilityTab]: allSheets[facilityTab],
          [floorTab]: allSheets[floorTab],
          [spaceTab]: allSheets[spaceTab],
          Component: allSheets[componentTab],
        });
        const locationGraph = buildLocationGraph(locationHierarchy);
        hierarchyResult = graphMode === 'system' ? systemGraph : locationGraph;
      }
      setHierarchy(hierarchyResult);
      setShowHierarchy(true);
    }, 0);
  };

  // Hide loading when modal shows
  useEffect(() => {
    if (showHierarchy) setShowHierarchyLoading(false);
  }, [showHierarchy]);

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
    // Isolate mode: if isolatedNodeId is set, show only the subgraph rooted at that node (any type)
    if (isolatedNodeId) {
      // Find all descendants (BFS)
      const nodeIds = new Set<string>();
      const edgeIds = new Set<string>();
      // Find path to root (walk up edges)
      let currentId = isolatedNodeId;
      while (true) {
        nodeIds.add(currentId);
        const parentEdge = hierarchy.edges.find((e: any) => e.target === currentId);
        if (parentEdge) {
          edgeIds.add(parentEdge.id);
          currentId = parentEdge.source;
        } else {
          break;
        }
      }
      // Walk down descendants (BFS)
      const queue = [isolatedNodeId];
      while (queue.length > 0) {
        const nid = queue.shift()!;
        nodeIds.add(nid);
        hierarchy.edges.forEach((e: any) => {
          if (e.source === nid) {
            edgeIds.add(e.id);
            if (!nodeIds.has(e.target)) queue.push(e.target);
          }
        });
      }
      const nodes = cyElements.filter((el: any) => el.data && nodeIds.has(el.data.id));
      const edges = cyElements.filter((el: any) => el.data && el.data.source && edgeIds.has(el.data.id))
        .map((el: any) => ({ ...el, classes: (el.classes || '') + ' highlighted-edge' }));
      return [...nodes, ...edges];
    }
    // If no filters, show all
    if (selectedSystem.length === 0 && selectedAssemblies.length === 0 && selectedSubassemblies.length === 0 && selectedComponent.length === 0) {
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
    if (selectedSystem.length > 0) {
      selectedSystem.forEach(name => {
        addReachable(`sys-${name}`);
      });
    }
    // Assembly filter (multi)
    selectedAssemblies.forEach(name => {
      addReachable(`asm-${name}`);
    });
    // Subassembly filter (multi)
    selectedSubassemblies.forEach(name => {
      addReachable(`asm-${name}`);
    });
    // Component filter (multi, isolates just that component and its direct edges)
    selectedComponent.forEach(name => {
      nodeIds.add(`comp-${name}`);
      hierarchy.edges.forEach((e: any) => {
        if (e.source === `comp-${name}` || e.target === `comp-${name}`) {
          edgeIds.add(e.id);
          nodeIds.add(e.source);
          nodeIds.add(e.target);
        }
      });
    });
    // Filter nodes and edges
    const nodes = cyElements.filter((el: any) => el.data && nodeIds.has(el.data.id));
    const edges = cyElements.filter((el: any) => el.data && el.data.source && edgeIds.has(el.data.id))
      .map((el: any) => ({ ...el, classes: (el.classes || '') + ' highlighted-edge' }));
    return [...nodes, ...edges];
  }, [cyElements, hierarchy, hierarchyType, selectedSystem, selectedAssemblies, selectedSubassemblies, selectedComponent, isolatedNodeId]);

  // Add a key to force CytoscapeComponent to re-render and re-layout when filter changes
  const cyKey = useMemo(() => `cy-${selectedSystem.join(',')}-${selectedAssemblies.join(',')}-${selectedSubassemblies.join(',')}-${selectedComponent.join(',')}-${selectedComponent.length}`,
    [selectedSystem, selectedAssemblies, selectedSubassemblies, selectedComponent]);

  const handleDb2Input = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDb2Settings((prev) => ({ ...prev, [name]: value }));
  };

  // Load connections from API
  useEffect(() => {
    if (activeTab === 'maximo') {
      setLoadingConnections(true);
      fetch('/api/maximo-connections')
        .then(res => res.json())
        .then(data => {
          setConnections(data);
          setLoadingConnections(false);
        })
        .catch(err => {
          setConnectionsError('Failed to load connections');
          setLoadingConnections(false);
        });
    }
  }, [activeTab]);

  // Save connection to API
  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setDb2Connecting(true);
    setDb2Error(null);
    setDb2Connected(false);
    try {
      const res = await fetch('/api/maximo-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...db2Settings,
          name: db2Settings.name || 'New Connection',
          id: db2Settings.id || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setDb2Connecting(false);
        setDb2Connected(true);
        setSelectedConnection(null);
        setDb2Settings({ id: '', name: '', hostname: '', port: '', database: '', username: '', password: '' });
        // Reload connections
        setLoadingConnections(true);
        fetch('/api/maximo-connections')
          .then(res => res.json())
          .then(data => {
            setConnections(data);
            setLoadingConnections(false);
          });
      } else {
        setDb2Error('Failed to save connection');
        setDb2Connecting(false);
      }
    } catch (err) {
      setDb2Error('Failed to save connection');
      setDb2Connecting(false);
    }
  };

  // Add delete handler
  const handleDeleteConnection = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) return;
    try {
      const res = await fetch('/api/maximo-connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (result.success) {
        setConnections(connections => connections.filter(conn => conn.id !== id));
        if (activeSessionId === id) setActiveSessionId(null);
      }
    } catch (err) {
      alert('Failed to delete connection.');
    }
  };

  // Persist activeSessionId in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('activeSessionId');
    if (stored) setActiveSessionId(stored);
  }, []);
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('activeSessionId', activeSessionId);
    } else {
      localStorage.removeItem('activeSessionId');
    }
  }, [activeSessionId]);

  // Drag handlers
  const handleDragStart = (type: 'cobie', e: React.MouseEvent) => {
    setDragging(type);
    const ref = cobieRef.current;
    if (ref) {
      const rect = ref.getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
  };
  const handleDrag = (e: React.MouseEvent) => {
    if (!dragging) return;
    const modal = modalRef.current;
    if (!modal) return;
    const bounds = modal.getBoundingClientRect();
    let x = e.clientX - bounds.left - dragOffset.x;
    let y = e.clientY - bounds.top - dragOffset.y;
    // Clamp to modal bounds (with some margin)
    x = Math.max(0, Math.min(x, bounds.width - 380));
    y = Math.max(0, Math.min(y, bounds.height - 80));
    if (dragging === 'cobie') setCobiePos({ x, y });
  };
  const handleDragEnd = () => {
    setDragging(null);
    document.body.style.userSelect = '';
  };

  // Add handler for running the query
  const handleRunQuery = useCallback(async () => {
    setQueryLoading(true);
    setQueryError(null);
    setQueryResults([]);
    if (!activeSessionId) {
      setQueryError('No active connection selected.');
      setQueryLoading(false);
      return;
    }
    const conn = connections.find(c => c.id === activeSessionId);
    if (!conn) {
      setQueryError('Active connection not found.');
      setQueryLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/maximo-connections/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlInput, connection: conn }),
      });
      const result = await res.json();
      if (result.success) {
        setQueryResults(result.rows || []);
        // Set all visible by default
        const vis: { [key: string]: boolean } = {};
        (result.rows || []).forEach((row: any, idx: number) => {
          vis[row.id || idx] = true;
        });
        setQueryVisibility(vis);
      } else {
        setQueryError(result.message || 'Query failed');
      }
    } catch (err) {
      setQueryError('Query failed');
    }
    setQueryLoading(false);
  }, [sqlInput, activeSessionId, connections]);

  // Add a click handler to close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      setShowSystemDropdown(false);
      setShowAssemblyDropdown(false);
      setShowSubassemblyDropdown(false);
      setShowComponentDropdown(false);
    };
    if (showSystemDropdown || showAssemblyDropdown || showSubassemblyDropdown || showComponentDropdown) {
      document.addEventListener('click', handleClick);
    }
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [showSystemDropdown, showAssemblyDropdown, showSubassemblyDropdown, showComponentDropdown]);

  // Place this before the return statement in SpreadsheetPage:
  const sortedComponentNames = [
    ...pendingComponent,
    ...(allComponentNames.filter((name: string) => !pendingComponent.includes(name)))
  ];

  // Helper to get path to root for a nodeId
  function getPathToRoot(nodeId: string): any[] {
    if (!hierarchy || !('nodes' in hierarchy) || !('edges' in hierarchy)) return [];
    const nodesById = Object.fromEntries(hierarchy.nodes.map((n: any) => [n.id, n]));
    const path = [];
    let currentId = nodeId;
    while (currentId && nodesById[currentId]) {
      path.unshift(nodesById[currentId]);
      const parentEdge = hierarchy.edges.find((e: any) => e.target === currentId);
      if (parentEdge) {
        currentId = parentEdge.source;
      } else {
        break;
      }
    }
    return path;
  }

  // Only update the location graph when filters change
  useEffect(() => {
    if (hierarchyType === 'graph' && graphMode === 'location' && allSheets[facilityTab]) {
      const locationHierarchy = buildCobieHierarchy({
        [facilityTab]: allSheets[facilityTab],
        [floorTab]: allSheets[floorTab],
        [spaceTab]: allSheets[spaceTab],
        Component: allSheets[componentTab],
      });
      const filteredHierarchy = filterLocationHierarchy(locationHierarchy);
      const locationGraph = buildLocationGraph(filteredHierarchy);
      setHierarchy(locationGraph);
    }
  }, [hierarchyType, graphMode, facilityTab, floorTab, spaceTab, componentTab, allSheets, selectedFacility, selectedFloor, selectedSpace, selectedZone]);

  if (file && !workbook) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{ fontSize: 64, marginBottom: 24 }}>🔄</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb' }}>Extracting COBie Data...</div>
          <div style={{ fontSize: 16, color: '#555', marginTop: 12 }}>Please wait while your spreadsheet is processed.</div>
        </div>
      </div>
    );
  }
  if (!file) {
    return null;
  }
  if (error) {
    return <div className="text-red-600 p-8 bg-gray-50">{error}</div>;
  }
  return (
    <div className="h-screen w-full bg-gray-50 px-0 pt-6 font-sans flex flex-col">
      {/* Tab Bar at the Top */}
      <div className="w-full bg-gradient-to-r from-gray-100 via-white to-gray-100 border-b border-gray-200 px-8 flex items-center gap-0 shadow-sm rounded-b-2xl" style={{minHeight: 44}}>
        <button
          className="px-4 py-2 font-semibold text-base rounded-t-xl border-b-4 border-blue-600 bg-white text-blue-800 shadow"
        >
          COBie Sheet Viewer
        </button>
      </div>
      <div className="w-full mx-auto flex flex-col flex-1 min-h-0 h-full">
        <header className="flex flex-col md:flex-row md:items-center md:justify-end mb-4 gap-3 px-6">
            <div className="flex flex-col gap-2 items-end mt-2">
            {/* Segmented control for hierarchy type */}
              <div className="flex gap-0.5 rounded-full overflow-hidden border border-gray-200 bg-gray-50 shadow-sm mb-1" style={{ minHeight: 32 }}>
                <button
                    className={`px-3 py-1 font-semibold text-sm rounded-full transition-all focus:outline-none ${hierarchyType === 'facility' ? 'bg-blue-600 text-white' : 'bg-transparent text-blue-700 hover:bg-blue-100'}`}
                  onClick={() => setHierarchyType('facility')}
                    style={{ minWidth: 70 }}
                >
                  Facility
                </button>
                <button
                    className={`px-3 py-1 font-semibold text-sm rounded-full transition-all focus:outline-none ${hierarchyType === 'system' ? 'bg-green-600 text-white' : 'bg-transparent text-green-700 hover:bg-green-100'}`}
                  onClick={() => setHierarchyType('system')}
                    style={{ minWidth: 70 }}
                >
                  System
                </button>
                <button
                    className={`px-3 py-1 font-semibold text-sm rounded-full transition-all focus:outline-none ${hierarchyType === 'graph' ? 'bg-purple-600 text-white' : 'bg-transparent text-purple-700 hover:bg-purple-100'}`}
                  onClick={() => setHierarchyType('graph')}
                    style={{ minWidth: 70 }}
                >
                  Graph
                </button>
              </div>
              {/* Dropdowns and Show Hierarchy button in a row */}
              <div className="flex flex-row gap-2 items-end mt-0">
              {hierarchyType === 'facility' ? (
                  <>
                    <div className="flex flex-col gap-0.5">
                      <label className="font-medium text-xs text-blue-700 mb-0.5">Facility</label>
                      <select value={facilityTab} onChange={e => setFacilityTab(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition min-w-[90px]">
                        {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="font-medium text-xs text-blue-700 mb-0.5">Floor</label>
                      <select value={floorTab} onChange={e => setFloorTab(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition min-w-[90px]">
                        {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="font-medium text-xs text-blue-700 mb-0.5">Space</label>
                      <select value={spaceTab} onChange={e => setSpaceTab(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition min-w-[90px]">
                        {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                </div>
                  </>
              ) : hierarchyType === 'system' ? (
                  <>
                    <div className="flex flex-col gap-0.5">
                      <label className="font-medium text-xs text-green-700 mb-0.5">System</label>
                      <input
                        type="text"
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 min-w-[90px]"
                        placeholder="Search..."
                        value={systemSearch}
                        onChange={e => setSystemSearch(e.target.value)}
                        style={{ minWidth: 0 }}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="font-medium text-xs text-green-700 mb-0.5">Component</label>
                      <select value={componentTab} onChange={e => setComponentTab(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition min-w-[90px]">
                        {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="font-medium text-xs text-green-700 mb-0.5">Assembly</label>
                      <select value={assemblyTab} onChange={e => setAssemblyTab(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition min-w-[90px]">
                        {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-0.5">
                      <label className="font-medium text-xs text-green-700 mb-0.5">System</label>
                      <select value={systemTab} onChange={e => setSystemTab(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition min-w-[90px]">
                        {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="font-medium text-xs text-green-700 mb-0.5">Component</label>
                      <select value={componentTab} onChange={e => setComponentTab(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition min-w-[90px]">
                        {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="font-medium text-xs text-green-700 mb-0.5">Assembly</label>
                      <select value={assemblyTab} onChange={e => setAssemblyTab(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition min-w-[90px]">
                        {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                </div>
                  </>
              )}
              <button
                  className="ml-2 px-3 py-1 text-xs font-semibold rounded bg-blue-600 text-white shadow hover:bg-blue-700 transition min-w-[90px]"
                onClick={openHierarchy}
                  disabled={showHierarchyLoading}
                  style={{ height: 32 }}
              >
                  {showHierarchyLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-blue-400 rounded-full animate-spin inline-block align-middle mr-1"></span>
                  ) : 'Show Hierarchy'}
              </button>
              </div>
            </div>
        </header>
        <div className="w-full flex-1 flex flex-col min-h-0 h-full">
          <div className="mb-4 border-b border-gray-200">
            <nav className="flex flex-wrap gap-2" style={{padding: '0 16px'}} aria-label="Tabs">
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
          <div className="shadow-lg overflow-auto bg-white flex-1 min-h-0 h-full" style={{ minHeight: 0, width: '100vw', maxWidth: '100vw' }}>
            <div className="w-full h-full flex-1" style={{ background: '#fff', boxShadow: '0 4px 16px 0 rgba(0,0,0,0.06)', height: '100%', minWidth: 0, width: '100vw', maxWidth: '100vw', borderRadius: 0 }}>
              <DataGrid
                columns={resizableColumns}
                rows={rows}
                className="rdg-light google-sheets-style"
                style={{
                  width: '100vw',
                  maxWidth: '100vw',
                  height: '100%',
                  fontFamily: 'Inter, Roboto, Arial, sans-serif',
                  fontSize: 15,
                  borderRadius: 0,
                  boxShadow: '0 4px 16px 0 rgba(0,0,0,0.06)',
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
          <div className="fixed inset-0 bg-black/20 transition-opacity" onClick={() => setShowHierarchy(false)} style={dragging ? { pointerEvents: 'none' } : {}} />
          {/* Bottom Modal */}
          <div
            ref={modalRef}
            className="relative w-full bg-white border border-gray-300 p-4 animate-slide-in-bottom flex flex-col"
            style={{ height: modalHeight, maxHeight: '90vh', minHeight: 400, margin: 0, borderRadius: 0, boxShadow: 'none' }}
            onMouseMove={handleDrag}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
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
              <div className="w-24 h-2 mt-2 bg-gray-200" />
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
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setShowHierarchy(false)}
              aria-label="Close"
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              &times;
            </button>
            <div className="flex items-center justify-between gap-4 mb-4 mt-2 border-b border-gray-200 pb-2">
              <h2 className="text-xl font-semibold text-gray-800 mb-0">COBie Hierarchy</h2>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-colors z-20"
                style={{ fontSize: 14 }}
                onClick={() => setShowControls(v => !v)}
              >
                {showControls ? 'Hide Controls' : 'Show Controls'}
              </button>
            </div>
            {hierarchyType === 'graph' ? (
              <div style={{ width: '100%', height: modalHeight - 90, position: 'relative' }}>
                {/* Graph mode toggle */}
                <div className="flex items-center gap-4 mb-2 px-2">
                  <label className="font-semibold text-base text-gray-700">Graph Mode:</label>
                  <button
                    className={`px-3 py-1 rounded-l border border-gray-300 font-semibold text-sm ${graphMode === 'system' ? 'bg-green-600 text-white' : 'bg-white text-green-700 hover:bg-green-100'}`}
                    onClick={() => setGraphMode('system')}
                  >
                    System
                  </button>
                  <button
                    className={`px-3 py-1 rounded-r border border-gray-300 font-semibold text-sm ${graphMode === 'location' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-100'}`}
                    onClick={() => setGraphMode('location')}
                  >
                    Location
                  </button>
                </div>
                {/* Draggable COBie Hierarchy Toolbox */}
                {showControls && (
                  <div
                    ref={cobieRef}
                    className="absolute z-30 bg-white border border-gray-300 overflow-auto cursor-grab"
                    style={{ left: cobiePos.x, top: cobiePos.y, width: 280, maxHeight: modalHeight - 120, borderRadius: 0, boxShadow: 'none' }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex-1 h-6 cursor-grab border-b border-gray-200 flex items-center px-2 text-gray-700 font-bold text-sm select-none bg-white" onMouseDown={e => handleDragStart('cobie', e)} style={{ borderRadius: 0 }}>
                        COBie Hierarchy Controls
                      </div>
                      <button
                        className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm font-semibold hover:underline transition-colors mr-1"
                        onClick={() => {
                          setSelectedSystem([]);
                          setSelectedAssemblies([]);
                          setSelectedSubassemblies([]);
                          setSelectedComponent([]);
                          setSelectedFacility([]);
                          setSelectedFloor([]);
                          setSelectedSpace([]);
                          setSelectedZone([]);
                        }}
                        title="Clear all filters"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-col p-2 text-base">
                      {/* Graph mode toggle */}
                      <div className="flex items-center gap-2 mb-2">
                        <label className="font-semibold text-base text-gray-700">Mode:</label>
                        <button
                          className={`px-2 py-1 rounded-l border border-gray-300 font-semibold text-sm ${graphMode === 'system' ? 'bg-green-600 text-white' : 'bg-white text-green-700 hover:bg-green-100'}`}
                          onClick={() => setGraphMode('system')}
                        >
                          System
                        </button>
                        <button
                          className={`px-2 py-1 rounded-r border border-gray-300 font-semibold text-sm ${graphMode === 'location' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-100'}`}
                          onClick={() => setGraphMode('location')}
                        >
                          Location
                        </button>
                      </div>
                      
                      {/* Facility/floor/space selectors for location mode */}
                      {graphMode === 'location' && (
                        <>
                          <FilterSection title="Facility" items={facilityNames as string[]} selectedItems={selectedFacility} onSelectionChange={setSelectedFacility} />
                          <FilterSection title="Floor" items={floorNames as string[]} selectedItems={selectedFloor} onSelectionChange={setSelectedFloor} />
                          <FilterSection title="Space" items={spaceNames as string[]} selectedItems={selectedSpace} onSelectionChange={setSelectedSpace} />
                          {zoneNames.length > 0 && <FilterSection title="Zone" items={zoneNames as string[]} selectedItems={selectedZone} onSelectionChange={setSelectedZone} />}
                        </>
                      )}
                      {/* System/Assembly/Component controls for system mode only */}
                      {graphMode === 'system' && (
                        <>
                           <FilterSection title="System" items={allSystemNames as string[]} selectedItems={selectedSystem} onSelectionChange={setSelectedSystem} />
                           <FilterSection title="Assembly" items={allAssemblyNames as string[]} selectedItems={selectedAssemblies} onSelectionChange={setSelectedAssemblies} />
                           <FilterSection title="Subassembly" items={allSubassemblyNames as string[]} selectedItems={selectedSubassemblies} onSelectionChange={setSelectedSubassemblies} />
                           <FilterSection title="Component" items={allComponentNames as string[]} selectedItems={selectedComponent} onSelectionChange={setSelectedComponent} />
                        </>
                      )}
                    </div>
                  </div>
                )}
                {(selectedSystem.length === 0 && selectedAssemblies.length === 0 && selectedSubassemblies.length === 0 && selectedComponent.length === 0) ? (
                  <div className="flex items-center justify-center w-full h-full text-lg text-gray-500 font-semibold">
                    Please select a System, Assembly, Subassembly, or Component to view the graph.
                  </div>
                ) : (
                  <>
                    <CytoscapeComponent
                      key={cyKey + (isolatedNodeId ? `-iso-${isolatedNodeId}` : '')}
                      elements={filteredCyElements}
                      style={{ width: '100%', height: '100%' }}
                      layout={{ name: 'breadthfirst', directed: true, padding: 100, spacingFactor: 2.5, animate: true, animationDuration: 600 }}
                      stylesheet={[
                        { selector: 'node', style: {
                            'label': 'data(label)',
                            'text-valign': 'center',
                            'color': '#134e1c',
                            'background-color': '#bbf7d0',
                            'border-width': 3,
                            'border-color': '#22c55e',
                            'font-size': 20,
                            'width': 80,
                            'height': 80,
                            'text-wrap': 'wrap',
                            'text-max-width': 70,
                            'z-index': 10,
                            'transition-property': 'background-color, border-color, width, height',
                            'transition-duration': '0.2s',
                          }
                        },
                        // Facility node style
                        { selector: 'node.facility', style: {
                            'background-color': '#2563eb',
                            'border-color': '#1e40af',
                            'shape': 'rectangle',
                            'font-weight': 'bold',
                            'width': 110,
                            'height': 60,
                            'font-size': 22,
                            'color': '#fff',
                          }
                        },
                        // Floor node style
                        { selector: 'node.floor', style: {
                            'background-color': '#06b6d4',
                            'border-color': '#0e7490',
                            'shape': 'roundrectangle',
                            'width': 100,
                            'height': 50,
                            'font-size': 18,
                            'color': '#fff',
                          }
                        },
                        // Space node style
                        { selector: 'node.space', style: {
                            'background-color': '#fde68a',
                            'border-color': '#f59e42',
                            'shape': 'ellipse',
                            'width': 90,
                            'height': 50,
                            'font-size': 16,
                            'color': '#92400e',
                          }
                        },
                        // Zone node style
                        { selector: 'node.zone', style: {
                            'background-color': '#a78bfa',
                            'border-color': '#7c3aed',
                            'shape': 'diamond',
                            'width': 80,
                            'height': 80,
                            'font-size': 16,
                            'color': '#4c1d95',
                          }
                        },
                        { selector: 'node.system', style: {
                            'background-color': '#22c55e',
                            'border-color': '#166534',
                            'shape': 'roundrectangle',
                            'font-weight': 'bold',
                            'width': 100,
                            'height': 100,
                            'font-size': 22,
                            'color': '#fff',
                          }
                        },
                        { selector: 'node.assembly', style: {
                            'background-color': '#4ade80',
                            'border-color': '#166534',
                            'shape': 'diamond',
                            'width': 90,
                            'height': 90,
                            'font-size': 18,
                            'color': '#134e1c',
                          }
                        },
                        { selector: 'node.component', style: {
                            'background-color': '#bbf7d0',
                            'border-color': '#22c55e',
                            'shape': 'ellipse',
                            'width': 80,
                            'height': 80,
                            'font-size': 16,
                            'color': '#134e1c',
                          }
                        },
                        { selector: 'edge', style: {
                            'width': 4,
                            'line-color': '#22c55e',
                            'target-arrow-color': '#22c55e',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'arrow-scale': 1.5,
                          }
                        },
                        { selector: 'edge.highlighted-edge', style: {
                            'line-color': '#166534',
                            'target-arrow-color': '#166534',
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
                        cy.on('tap', 'node', (evt: any) => {
                          const node = evt.target;
                          setIsolatedNodeId(node.id()); // highlight path to top
                          setSelectedNodeDetails(node.data()); // show details panel
                        });
                        cy.on('cxttap', 'node', (evt: any) => {
                          evt.preventDefault();
                          const node = evt.target;
                          const pos = evt.renderedPosition || node.renderedPosition();
                          // Get mouse position relative to viewport
                          const cyContainer = cy.container();
                          const rect = cyContainer.getBoundingClientRect();
                          setContextMenu({
                            x: rect.left + pos.x,
                            y: rect.top + pos.y,
                            nodeId: node.id(),
                            nodeData: node.data(),
                            nodeType: node.data().type,
                          });
                        });
                        cy.on('cxttap', (evt: any) => {
                          // Right-click on background closes menu and clears isolation
                          if (evt.target === cy) {
                            setContextMenu(null);
                            setIsolatedNodeId(null);
                            setSelectedNodeDetails(null);
                          }
                        });
                      }}
                    />
                    {cyTooltip && (
                      <div
                        className="fixed z-50 p-2 bg-white border rounded shadow text-xs"
                        style={{ left: cyTooltip.x + 20, top: cyTooltip.y + 80, pointerEvents: 'none', minWidth: 260, maxWidth: 400 }}
                        dangerouslySetInnerHTML={{ __html: cyTooltip.content }}
                      />
                    )}
                    {contextMenu && (
                      <div
                        className="fixed z-50 bg-white border border-gray-300 rounded shadow-lg text-base min-w-[160px]"
                        style={{ left: contextMenu.x, top: contextMenu.y, boxShadow: '0 4px 16px 0 rgba(0,0,0,0.10)' }}
                        tabIndex={-1}
                        onBlur={() => setContextMenu(null)}
                      >
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-green-100 text-green-800 font-semibold rounded-t"
                          onClick={() => {
                            setIsolatedNodeId(contextMenu.nodeId);
                            setContextMenu(null);
                          }}
                        >
                          Isolate Hierarchy
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-blue-100 text-blue-800 font-semibold"
                          onClick={() => {
                            if (contextMenu.nodeType === 'component') {
                              setSelectedComponentNode(contextMenu.nodeData);
                            } else {
                              setSelectedNodeDetails(contextMenu.nodeData);
                            }
                            setContextMenu(null);
                          }}
                        >
                          View Details
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700 rounded-b"
                          onClick={() => setContextMenu(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {isolatedNodeId && (
                      <button
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-green-700 text-white rounded shadow hover:bg-green-800 transition"
                        onClick={() => setIsolatedNodeId(null)}
                        style={{ fontSize: 16 }}
                      >
                        Show Full Graph
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : hierarchyType === 'system' ? (
              <div style={{ width: '100%', maxHeight: modalHeight - 80, overflow: 'auto', paddingRight: 8 }}>
                <SystemDrilldownTree hierarchy={hierarchy} />
              </div>
            ) : (
              <div style={{ maxHeight: modalHeight - 80, overflowY: 'auto' }}>
                <HierarchyTree hierarchy={hierarchy} />
              </div>
            )}
          </div>
          {/* Render a side modal when selectedComponentNode is set */}
          {selectedComponentNode && (
            <div 
              className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-in-right"
              style={{
                boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
                borderLeft: '1px solid #e5e7eb'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-gray-800">Component Details</h2>
                </div>
                <button
                  onClick={() => setSelectedComponentNode(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Path to root breadcrumb */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Hierarchy Path
                  </h3>
                  <div className="text-sm text-gray-600 leading-relaxed">
                    {getPathToRoot(selectedComponentNode.id || selectedComponentNode.ID || selectedComponentNode.Name)
                      .map((n, idx, arr) => (
                        <span key={n.id || n.data?.Name || idx}>
                          <span className="font-medium text-gray-800">
                            {n.data?.Name || n.data?.label || n.label || n.id}
                          </span>
                          {idx < arr.length - 1 && (
                            <span className="mx-2 text-gray-400">→</span>
                          )}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Main title */}
                <div className="border-b border-gray-200 pb-4">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedComponentNode.label || selectedComponentNode.Name}
                  </h1>
                  <p className="text-sm text-gray-500">Component Information</p>
                </div>

                {/* Properties */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Properties
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(selectedComponentNode).map(([k, v]) => (
                      <div key={k} className="bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div className="text-sm font-semibold text-gray-700 mb-1 capitalize">
                          {k.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-sm text-gray-600 break-words">
                          {String(v) || <span className="text-gray-400 italic">Not specified</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {selectedNodeDetails && (
            <div 
              className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-in-right"
              style={{
                boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
                borderLeft: '1px solid #e5e7eb'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-gray-800">Node Details</h2>
                </div>
                <button
                  onClick={() => setSelectedNodeDetails(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Path to root breadcrumb */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Hierarchy Path
                  </h3>
                  <div className="text-sm text-gray-600 leading-relaxed">
                    {getPathToRoot(selectedNodeDetails.id || selectedNodeDetails.ID || selectedNodeDetails.Name)
                      .map((n, idx, arr) => (
                        <span key={n.id || n.data?.Name || idx}>
                          <span className="font-medium text-gray-800">
                            {n.data?.Name || n.data?.label || n.label || n.id}
                          </span>
                          {idx < arr.length - 1 && (
                            <span className="mx-2 text-gray-400">→</span>
                          )}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Main title */}
                <div className="border-b border-gray-200 pb-4">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedNodeDetails.label || selectedNodeDetails.Name}
                  </h1>
                  <p className="text-sm text-gray-500">Node Information</p>
                </div>

                {/* Properties */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Properties
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(selectedNodeDetails).map(([k, v]) => (
                      <div key={k} className="bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div className="text-sm font-semibold text-gray-700 mb-1 capitalize">
                          {k.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-sm text-gray-600 break-words">
                          {String(v) || <span className="text-gray-400 italic">Not specified</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <style jsx global>{`
            @keyframes slide-in-bottom {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slide-in-right {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            .animate-slide-in-bottom {
              animation: slide-in-bottom 0.3s cubic-bezier(0.4,0,0.2,1);
            }
            .animate-slide-in-right {
              animation: slide-in-right 0.3s cubic-bezier(0.4,0,0.2,1);
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            .animate-spin { animation: spin 0.7s linear infinite; }
          `}</style>
        </div>
      )}
    </div>
  );
} 