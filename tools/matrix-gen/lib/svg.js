// SVG primitives for matrix cells. Pure strings, no dependencies.
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

function shapeSVG(kind, cx, cy, size, fill, stroke){
  const f = fill || 'none';
  const st = stroke || '#3b2a1a';
  const sw = 2;
  if(kind==='circle') return '<circle cx="'+cx+'" cy="'+cy+'" r="'+(size/2)+'" fill="'+f+'" stroke="'+st+'" stroke-width="'+sw+'"/>';
  if(kind==='square') return '<rect x="'+(cx-size/2)+'" y="'+(cy-size/2)+'" width="'+size+'" height="'+size+'" fill="'+f+'" stroke="'+st+'" stroke-width="'+sw+'"/>';
  if(kind==='triangle'){
    const h=size*0.866;
    const pts=(cx)+','+(cy-h/2)+' '+(cx-size/2)+','+(cy+h/2)+' '+(cx+size/2)+','+(cy+h/2);
    return '<polygon points="'+pts+'" fill="'+f+'" stroke="'+st+'" stroke-width="'+sw+'" stroke-linejoin="round"/>';
  }
  if(kind==='diamond'){
    const pts=(cx)+','+(cy-size/2)+' '+(cx+size/2)+','+(cy)+' '+(cx)+','+(cy+size/2)+' '+(cx-size/2)+','+(cy);
    return '<polygon points="'+pts+'" fill="'+f+'" stroke="'+st+'" stroke-width="'+sw+'" stroke-linejoin="round"/>';
  }
  if(kind==='arrow'){
    // asymmetric shape for rotation rule; points up by default
    const s=size/2;
    return '<g transform="translate('+cx+','+cy+')" fill="'+f+'" stroke="'+st+'" stroke-width="'+sw+'" stroke-linejoin="round">'
      +'<polygon points="0,'+(-s)+' '+s+','+s+' 0,'+(s*0.35)+' '+(-s)+','+s+'"/></g>';
  }
  if(kind==='L'){
    const s=size/2;
    return '<g transform="translate('+cx+','+cy+')" fill="none" stroke="'+st+'" stroke-width="'+(sw+1)+'" stroke-linecap="round">'
      +'<path d="M '+(-s)+' '+(-s)+' L '+(-s)+' '+s+' L '+s+' '+s+'"/></g>';
  }
  return '<circle cx="'+cx+'" cy="'+cy+'" r="3" fill="'+st+'"/>';
}

function dotGrid(n, cx, cy, spread, color){
  // draw n small dots arranged in a row/grid inside a cell
  let s='';
  const cols = n<=3 ? n : 3;
  for(let i=0;i<n;i++){
    const r=Math.floor(i/cols), c=i%cols;
    const countInRow = Math.min(cols, n-r*cols);
    const x = cx + (c-(countInRow-1)/2)*spread;
    const y = cy + (r-(Math.ceil(n/cols)-1)/2)*spread;
    s+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="5" fill="'+(color||'#3b2a1a')+'"/>';
  }
  return s;
}

function renderMatrixSVG(cells, opts){
  // cells: 3x3 array of {svg: innerContent}; opts: {cell: px, missing: [r,c]}
  const cell = (opts&&opts.cell)||90;
  const W = cell*3, H = cell*3;
  let s='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">';
  s+='<rect x="1" y="1" width="'+(W-2)+'" height="'+(H-2)+'" rx="10" fill="#fbf6ec" stroke="#d9c9a8" stroke-width="2"/>';
  for(let r=0;r<3;r++) for(let c=0;c<3;c++){
    const x=c*cell, y=r*cell;
    s+='<rect x="'+x+'" y="'+y+'" width="'+cell+'" height="'+cell+'" fill="none" stroke="#d9c9a8" stroke-width="1"/>';
    const cx=x+cell/2, cy=y+cell/2;
    if(opts&&opts.missing&&opts.missing[0]===r&&opts.missing[1]===c){
      s+='<text x="'+cx+'" y="'+(cy+8)+'" text-anchor="middle" font-size="28" fill="#8a6d47">?</text>';
    } else {
      s+='<g>'+cells[r][c].svg+'</g>';
    }
  }
  return s+'</svg>';
}

function renderOptionsSVG(optionSvgs, opts){
  const cell=(opts&&opts.cell)||70;
  let s='';
  for(let i=0;i<optionSvgs.length;i++){
    s+='<svg xmlns="http://www.w3.org/2000/svg" width="'+cell+'" height="'+cell+'" viewBox="0 0 '+cell+' '+cell+'">'
      +'<rect x="1" y="1" width="'+(cell-2)+'" height="'+(cell-2)+'" rx="8" fill="#f6efe2" stroke="#d9c9a8" stroke-width="2"/>'
      +'<g>'+optionSvgs[i]+'</g></svg>';
  }
  return s;
}

module.exports={shapeSVG,dotGrid,renderMatrixSVG,renderOptionsSVG,esc};
