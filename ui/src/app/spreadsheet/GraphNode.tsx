import React from "react";
import { Handle, Position } from "reactflow";

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

export default GraphNode; 