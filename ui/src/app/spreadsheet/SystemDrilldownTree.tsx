import React, { useState, useCallback } from "react";

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

export default SystemDrilldownTree; 