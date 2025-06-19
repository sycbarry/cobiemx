import React, { useState, useCallback } from "react";

function HierarchyTree({ hierarchy }: { hierarchy: any }) {
  // Debug: log the hierarchy structure
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('HierarchyTree hierarchy:', hierarchy);
  }, [hierarchy]);

  // Expand/collapse state
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
  const toggle = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (!hierarchy || hierarchy.error) return <div className="text-red-600">{hierarchy?.error || "No hierarchy data"}</div>;
  if (hierarchy.facilities) {
    return (
      <div className="text-base font-sans">
        {hierarchy.facilities.map((fac: any, fidx: number) => {
          const facId = `fac-${fac.Name || fidx}`;
          return (
            <div key={facId} className="mb-4">
              <div
                className="flex items-center gap-2 cursor-pointer group py-2 px-2 rounded-lg hover:bg-blue-50 transition"
                onClick={() => toggle(facId)}
                style={{ minWidth: 180 }}
              >
                <span className="text-xl select-none transition-transform" style={{ display: 'inline-block', transform: expanded[facId] ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  ▶
                </span>
                <span className="font-extrabold text-blue-700 text-lg tracking-tight">{fac.Name}</span>
                {fac.floors && fac.floors.length > 0 && <span className="text-xs text-blue-600 ml-2">({fac.floors.length} floors)</span>}
              </div>
              {expanded[facId] && fac.floors && fac.floors.length > 0 && (
                <div className="ml-7 border-l-2 border-blue-100 pl-4 mt-2">
                  {fac.floors.map((floor: any, flidx: number) => {
                    const floorId = `${facId}-floor-${floor.Name || flidx}`;
                    return (
                      <div key={floorId} className="mb-2">
                        <div
                          className="flex items-center gap-2 cursor-pointer group py-1 px-1 rounded hover:bg-blue-50 transition"
                          onClick={() => toggle(floorId)}
                          style={{ minWidth: 120 }}
                        >
                          <span className="text-lg select-none transition-transform" style={{ display: 'inline-block', transform: expanded[floorId] ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                            ▶
                          </span>
                          <span className="font-semibold text-blue-500 text-base">{floor.Name}</span>
                          {floor.spaces && floor.spaces.length > 0 && <span className="text-xs text-blue-400 ml-1">({floor.spaces.length} spaces)</span>}
                        </div>
                        {expanded[floorId] && floor.spaces && floor.spaces.length > 0 && (
                          <div className="ml-6 border-l border-blue-50 pl-3 mt-1">
                            {floor.spaces.map((space: any, sidx: number) => {
                              const spaceId = `${floorId}-space-${space.Name || sidx}`;
                              return (
                                <div key={spaceId} className="mb-1">
                                  <div
                                    className="flex items-center gap-2 cursor-pointer group py-1 px-1 rounded hover:bg-gray-50 transition"
                                    onClick={() => toggle(spaceId)}
                                    style={{ minWidth: 100 }}
                                  >
                                    <span className="text-base select-none transition-transform" style={{ display: 'inline-block', transform: expanded[spaceId] ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                      ▶
                                    </span>
                                    <span className="font-semibold text-gray-800">{space.Name}</span>
                                    {space.zones && space.zones.length > 0 && <span className="text-xs text-orange-600 ml-1">({space.zones.length} zones)</span>}
                                    {(!space.zones || space.zones.length === 0) && space.components && space.components.length > 0 && <span className="text-xs text-purple-600 ml-1">({space.components.length} components)</span>}
                                  </div>
                                  {expanded[spaceId] && (
                                    <div className="ml-6 border-l border-gray-100 pl-3 mt-1">
                                      {/* Zones under this space, if any */}
                                      {space.zones && Array.isArray(space.zones) && space.zones.length > 0 ? (
                                        <div>
                                          {space.zones.map((zone: any, zidx: number) => {
                                            const zoneId = `${spaceId}-zone-${zone.Name || zidx}`;
                                            return (
                                              <div key={zoneId} className="mb-1">
                                                <div
                                                  className="flex items-center gap-2 cursor-pointer group py-1 px-1 rounded hover:bg-orange-50 transition"
                                                  onClick={() => toggle(zoneId)}
                                                  style={{ minWidth: 80 }}
                                                >
                                                  <span className="text-base select-none transition-transform" style={{ display: 'inline-block', transform: expanded[zoneId] ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                                    ▶
                                                  </span>
                                                  <span className="font-semibold text-orange-700">{zone.Name}</span>
                                                  {zone.components && zone.components.length > 0 && <span className="text-xs text-purple-600 ml-1">({zone.components.length} components)</span>}
                                                </div>
                                                {/* Expandable components list under zone */}
                                                {zone.components && zone.components.length > 0 && (
                                                  <div className="ml-6 mt-1">
                                                    <div
                                                      className="flex items-center gap-2 cursor-pointer group py-1 px-1 rounded hover:bg-purple-50 transition"
                                                      onClick={() => toggle(`${zoneId}-components`)}
                                                    >
                                                      <span className="text-sm select-none transition-transform" style={{ display: 'inline-block', transform: expanded[`${zoneId}-components`] ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                                        ▶
                                                      </span>
                                                      <span className="font-semibold text-purple-700">Components</span>
                                                      <span className="text-xs text-purple-600 ml-1">({zone.components.length})</span>
                                                    </div>
                                                    {expanded[`${zoneId}-components`] && (
                                                      <ul className="ml-6 list-disc">
                                                        {zone.components.map((comp: any, cidx: number) => (
                                                          <li key={comp.Name || cidx} className="text-purple-700">🔩 {comp.Name || `Component ${cidx+1}`}</li>
                                                        ))}
                                                      </ul>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        // No zones: show components directly under space
                                        space.components && space.components.length > 0 && (
                                          <div className="ml-6 mt-1">
                                            <div
                                              className="flex items-center gap-2 cursor-pointer group py-1 px-1 rounded hover:bg-purple-50 transition"
                                              onClick={() => toggle(`${spaceId}-components`)}
                                            >
                                              <span className="text-sm select-none transition-transform" style={{ display: 'inline-block', transform: expanded[`${spaceId}-components`] ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                                ▶
                                              </span>
                                              <span className="font-semibold text-purple-700">Components</span>
                                              <span className="text-xs text-purple-600 ml-1">({space.components.length})</span>
                                            </div>
                                            {expanded[`${spaceId}-components`] && (
                                              <ul className="ml-6 list-disc">
                                                {space.components.map((comp: any, cidx: number) => (
                                                  <li key={comp.Name || cidx} className="text-purple-700">🔩 {comp.Name || `Component ${cidx+1}`}</li>
                                                ))}
                                              </ul>
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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

export default HierarchyTree; 