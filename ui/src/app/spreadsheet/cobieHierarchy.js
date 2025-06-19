// cobieHierarchy.js
// Library for constructing a hierarchy tree from COBie spreadsheet data

/**
 * Build a Facility > Floor > Space > Zone (optional) > Component hierarchy tree from COBie data.
 * @param {Object} sheets - An object where keys are sheet names and values are arrays of rows (first row is header).
 * @returns {Object} Hierarchy tree
 */
export function buildCobieHierarchy(sheets) {
  const facilitySheet = sheets["Facility"];
  const floorSheet = sheets["Floor"];
  const spaceSheet = sheets["Space"];
  const zoneSheet = sheets["Zone"];
  const componentSheet = sheets["Component"];

  if (!facilitySheet || !floorSheet || !spaceSheet) return { error: "Missing required sheets" };

  // Parse headers
  const [facilityHeader, ...facilityRows] = facilitySheet;
  const [floorHeader, ...floorRows] = floorSheet;
  const [spaceHeader, ...spaceRows] = spaceSheet;
  const [zoneHeader, ...zoneRows] = zoneSheet || [[], []];
  const [componentHeader, ...componentRows] = componentSheet || [[], []];

  // Helper: get column index safely
  const colIdx = (header, col) => header.indexOf(col);

  // Build a map of Zones if present
  let zoneMap = {};
  if (zoneSheet) {
    // Map: ZoneName -> Zone object
    zoneRows.forEach(row => {
      const zone = {};
      zoneHeader.forEach((h, i) => zone[h] = row[i]);
      if (zone["Name"]) zoneMap[zone["Name"]] = zone;
    });
  }

  // Build a map of Components by Space (normalize: trim + uppercase)
  let componentsBySpace = {};
  if (componentSheet) {
    const spaceCol = componentHeader.includes("SpaceName") ? colIdx(componentHeader, "SpaceName") : colIdx(componentHeader, "Space");
    componentRows.forEach(row => {
      const comp = {};
      componentHeader.forEach((h, i) => comp[h] = row[i]);
      const rawSpaceName = row[spaceCol];
      const spaceName = (rawSpaceName || '').trim().toUpperCase();
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log('Component row spaceCol value:', rawSpaceName, '-> normalized:', spaceName);
      }
      if (!componentsBySpace[spaceName]) componentsBySpace[spaceName] = [];
      componentsBySpace[spaceName].push(comp);
    });
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log('componentsBySpace keys after build:', Object.keys(componentsBySpace));
    }
  }

  // Build a map of Zones by Space (if Space has a Zone column)
  let zoneBySpace = {};
  if (spaceHeader.includes("Zone")) {
    const zoneCol = colIdx(spaceHeader, "Zone");
    spaceRows.forEach(row => {
      const spaceName = row[spaceHeader.indexOf("Name")];
      const zoneName = row[zoneCol];
      if (zoneName) zoneBySpace[spaceName] = zoneName;
    });
  }

  // Build the hierarchy
  const facilities = facilityRows.map(facRow => {
    const fac = {};
    facilityHeader.forEach((h, i) => fac[h] = facRow[i]);
    // If Floor sheet has FacilityName column, filter by it. Otherwise, assign all floors (COBie standard)
    const hasFacilityNameCol = floorHeader.includes("FacilityName");
    fac.floors = (hasFacilityNameCol
      ? floorRows.filter(floorRow => floorRow[floorHeader.indexOf("FacilityName")] === fac["Name"])
      : floorRows
    ).map(floorRow => {
      const floor = {};
      floorHeader.forEach((h, i) => floor[h] = floorRow[i]);
      // Find spaces for this floor
      floor.spaces = spaceRows
        .filter(spaceRow => spaceRow[spaceHeader.indexOf("FloorName")] === floor["Name"])
        .map(spaceRow => {
          const space = {};
          spaceHeader.forEach((h, i) => space[h] = spaceRow[i]);
          const spaceName = (space["Name"] || '').trim().toUpperCase();
          if (typeof window !== 'undefined') {
            // eslint-disable-next-line no-console
            console.log('Normalized spaceName:', spaceName, 'componentsBySpace[spaceName]:', componentsBySpace[spaceName]);
          }
          // If Zone sheet/column exists, nest under Zone
          let children = [];
          if (zoneSheet && zoneBySpace[spaceName]) {
            const zoneName = zoneBySpace[spaceName];
            let zoneObj = zoneMap[zoneName] ? { ...zoneMap[zoneName], components: [] } : { Name: zoneName, components: [] };
            zoneObj.components = (componentsBySpace[spaceName] || []);
            children.push(zoneObj);
          } else {
            space.components = (componentsBySpace[spaceName] || []);
          }
          if (children.length > 0) space.zones = children;
          return space;
        });
      return floor;
    });
    return fac;
  });

  return { facilities };
}

/**
 * Build a System > Component > Assembly hierarchy tree from COBie data.
 * @param {Object} sheets - An object where keys are sheet names and values are arrays of rows (first row is header).
 * @returns {Object} System hierarchy tree
 */
export function buildCobieSystemHierarchy(sheets) {
  const systemSheet = sheets["System"];
  const componentSheet = sheets["Component"];
  const assemblySheet = sheets["Assembly"];

  if (!systemSheet || !componentSheet || !assemblySheet) return { error: "Missing required sheets" };

  const [systemHeader, ...systemRows] = systemSheet;
  const [componentHeader, ...componentRows] = componentSheet;
  const [assemblyHeader, ...assemblyRows] = assemblySheet;

  // Helper: find component row by name
  function findComponentByName(name) {
    const idx = componentHeader.indexOf("Name");
    return componentRows.find(row => row[idx] === name);
  }

  // Build tree: System > Components > Assemblies
  const systems = systemRows.map(sysRow => {
    const sys = {};
    systemHeader.forEach((h, i) => sys[h] = sysRow[i]);

    // Components in this system (by SystemName field, if present)
    let components = [];
    const systemNameIdx = componentHeader.indexOf("SystemName");
    if (systemNameIdx !== -1) {
      components = componentRows
        .filter(compRow => compRow[systemNameIdx] === sys["Name"])
        .map(compRow => {
          const comp = {};
          componentHeader.forEach((h, i) => comp[h] = compRow[i]);
          // Assemblies in this component
          comp.assemblies = assemblyRows.filter(asmRow => {
            // ComponentName in Assembly links to Name in Component
            return asmRow[assemblyHeader.indexOf("ComponentName")] === comp["Name"];
          });
          return comp;
        });
    }

    // Also add components by parsing ComponentNames field (semicolon-separated)
    const compNamesStr = sys["ComponentNames"] || "";
    const compNames = compNamesStr.split(";").map(s => s.trim()).filter(Boolean);
    compNames.forEach(name => {
      // Only add if not already present
      if (!components.some(c => c.Name === name)) {
        const compRow = findComponentByName(name);
        if (compRow) {
          const comp = {};
          componentHeader.forEach((h, i) => comp[h] = compRow[i]);
          comp.assemblies = assemblyRows.filter(asmRow => {
            return asmRow[assemblyHeader.indexOf("ComponentName")] === comp["Name"];
          });
          components.push(comp);
        }
      }
    });

    sys.components = components;
    return sys;
  });

  return { systems };
}

/**
 * Build a graph-style hierarchy from COBie data:
 * - Each component is a node (from Component tab)
 * - Each assembly row (from Assembly tab) defines an edge: ParentName -> ChildName
 * @param {Object} sheets - keys: 'Component', 'Assembly'
 * @returns {Object} {nodes, edges}
 */
export function buildCobieGraphHierarchy(sheets) {
  const componentSheet = sheets["Component"];
  const assemblySheet = sheets["Assembly"];
  const systemSheet = sheets["System"];
  if (!componentSheet || !assemblySheet || !systemSheet) return { nodes: [], edges: [] };

  // Parse nodes
  const [componentHeader, ...componentRows] = componentSheet;
  const [assemblyHeader, ...assemblyRows] = assemblySheet;
  const [systemHeader, ...systemRows] = systemSheet;

  // System nodes
  const systemNodes = systemRows.map((row, i) => {
    const sys = {};
    systemHeader.forEach((h, j) => sys[h] = row[j]);
    return {
      id: `sys-${sys.Name}`,
      type: "system",
      data: sys,
      position: { x: 100 + (i % 10) * 200, y: 50 },
    };
  });

  // Assembly nodes (unique ParentNames)
  const assemblyNames = Array.from(new Set(assemblyRows.map(row => row[assemblyHeader.indexOf("ParentName")])));
  const assemblyNodes = assemblyNames.map((name, i) => ({
    id: `asm-${name}`,
    type: "assembly",
    data: { Name: name },
    position: { x: 100 + (i % 10) * 200, y: 200 },
  }));

  // Component nodes (from Component sheet)
  const componentNames = componentRows.map(row => row[componentHeader.indexOf("Name")]);
  const componentNodes = componentRows.map((row, i) => {
    const comp = {};
    componentHeader.forEach((h, j) => comp[h] = row[j]);
    return {
      id: `comp-${comp.Name}`,
      type: "component",
      data: comp,
      position: { x: 100 + (i % 10) * 200, y: 350 },
    };
  });

  // Edges: System -> Assembly (if assembly is in system's ComponentNames)
  const sysEdges = [];
  systemRows.forEach(sysRow => {
    const sysName = sysRow[systemHeader.indexOf("Name")];
    const compList = (sysRow[systemHeader.indexOf("ComponentNames")] || "").split(";").map(s => s.trim());
    assemblyNames.forEach(parentName => {
      if (compList.includes(parentName)) {
        sysEdges.push({
          id: `e-sys-${sysName}-asm-${parentName}`,
          source: `sys-${sysName}`,
          target: `asm-${parentName}`,
        });
      }
    });
  });

  // Edges: Assembly -> Component (from Assembly sheet)
  const parentNameIdx = assemblyHeader.indexOf("ParentName");
  const childNameIdx = assemblyHeader.indexOf("ChildName");
  const asmEdges = assemblyRows
    .filter(row => row[parentNameIdx] && row[childNameIdx])
    .map(row => ({
      id: `e-asm-${row[parentNameIdx]}-comp-${row[childNameIdx]}`,
      source: `asm-${row[parentNameIdx]}`,
      target: `comp-${row[childNameIdx]}`,
    }));

  // Edges: System -> Component (for components in ComponentNames that are not ParentName or ChildName in Assembly)
  const allChildNames = new Set(assemblyRows.map(row => row[childNameIdx]));
  systemRows.forEach(sysRow => {
    const sysName = sysRow[systemHeader.indexOf("Name")];
    const compList = (sysRow[systemHeader.indexOf("ComponentNames")] || "").split(";").map(s => s.trim());
    compList.forEach(compName => {
      if (!assemblyNames.includes(compName) && !allChildNames.has(compName) && componentNames.includes(compName)) {
        sysEdges.push({
          id: `e-sys-${sysName}-comp-${compName}`,
          source: `sys-${sysName}`,
          target: `comp-${compName}`,
        });
      }
    });
  });

  return {
    nodes: [...systemNodes, ...assemblyNodes, ...componentNodes],
    edges: [...sysEdges, ...asmEdges],
  };
} 