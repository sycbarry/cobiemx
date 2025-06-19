import React from "react";

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

export default HierarchyTree; 