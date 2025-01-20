<template>
    <div id="app">
      <h1>Graph Visualization</h1>
      <div id="cy" style="width: 600px; height: 400px; border: 1px solid #ccc;"></div>
    </div>
  </template>
  
  <script>
  import cytoscape from 'cytoscape';
  
  export default {
    name: 'App',
    mounted() {
      this.initializeGraph();
    },
    methods: {
      initializeGraph() {
        const cy = cytoscape({
          container: document.getElementById('cy'),
          elements: [
            // Nodes
            { data: { id: 'a', label: 'Component A' } },
            { data: { id: 'b', label: 'Component B' } },
            // Edge
            { data: { id: 'ab', source: 'a', target: 'b', label: 'Connection' } },
          ],
          style: [
            {
              selector: 'node',
              style: {
                'background-color': '#0074D9',
                label: 'data(label)',
                color: '#fff',
                'text-valign': 'center',
                'text-halign': 'center',
              },
            },
            {
              selector: 'edge',
              style: {
                'width': 2,
                'line-color': '#0074D9',
                'target-arrow-color': '#0074D9',
                'target-arrow-shape': 'triangle',
                label: 'data(label)',
                color: '#000',
                'font-size': '10px',
                'text-background-opacity': 1,
                'text-background-color': '#fff',
                'text-background-padding': '2px',
              },
            },
          ],
          layout: {
            name: 'grid',
          },
        });
      },
    },
  };
  </script>
  
  <style>
  #app {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: Arial, sans-serif;
  }
  
  h1 {
    color: #333;
  }
  </style>
  