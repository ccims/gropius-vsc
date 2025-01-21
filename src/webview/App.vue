<!-- Graph.vue -->
<template>
    <div class="graph-container" ref="container">
      <svg :width="width" :height="height">
        <!-- Background Pattern -->
        <defs>
          <pattern 
            id="dotPattern" 
            width="20" 
            height="20" 
            patternUnits="userSpaceOnUse"
          >
            <circle 
              cx="2" 
              cy="2" 
              r="1" 
              fill="#ccc"
            />
          </pattern>
        </defs>
        
        <!-- Background Rectangle with Pattern -->
        <rect
          width="100%"
          height="100%"
          fill="url(#dotPattern)"
        />
  
        <!-- Links -->
        <g class="links">
          <path
            v-for="link in links"
            :key="link.id"
            :d="getLinkPath(link)"
            stroke="#999"
            stroke-width="2"
            fill="none"
            marker-end="url(#arrowhead)"
          />
        </g>
  
        <!-- Nodes -->
        <g class="nodes">
          <g
            v-for="node in nodes"
            :key="node.id"
            :transform="`translate(${node.x},${node.y})`"
            class="node"
          >
            <!-- Component Rectangle -->
            <rect
              :width="nodeWidth"
              :height="nodeHeight"
              fill="white"
              stroke="#333"
              stroke-width="2"
              rx="4"
            />
            <!-- Component Label -->
            <text
              :x="nodeWidth / 2"
              :y="nodeHeight / 2"
              text-anchor="middle"
              alignment-baseline="middle"
              fill="#333"
            >
              {{ node.label }}
            </text>
          </g>
        </g>
  
        <!-- Arrow Marker Definition -->
        <defs>
          <marker
            id="arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#999"/>
          </marker>
        </defs>
      </svg>
    </div>
  </template>
  
  <script>
  export default {
    name: 'Graph',
    data() {
      return {
        width: 600,
        height: 400,
        nodeWidth: 120,
        nodeHeight: 60,
        nodes: [
          { id: 1, label: 'Component A', x: 100, y: 100 },
          { id: 2, label: 'Component B', x: 400, y: 100 }
        ],
        links: [
          { id: 1, source: 1, target: 2, label: 'Interface' }
        ]
      }
    },
    methods: {
      getLinkPath(link) {
        const source = this.nodes.find(n => n.id === link.source)
        const target = this.nodes.find(n => n.id === link.target)
        
        // Calculate start and end points (from right side of source to left side of target)
        const startX = source.x + this.nodeWidth
        const startY = source.y + this.nodeHeight / 2
        const endX = target.x
        const endY = target.y + this.nodeHeight / 2
        
        return `M ${startX} ${startY} L ${endX} ${endY}`
      }
    }
  }
  </script>
  
  <style scoped>
  .graph-container {
    background-color: #ffffff;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .node {
    cursor: pointer;
  }
  
  .node:hover rect {
    stroke: #666;
  }
  </style>