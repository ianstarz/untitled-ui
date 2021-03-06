function TransformUITableComponents() {
  // set later within Glimmer2 to the syntax package
  this.syntax = null;
}

TransformUITableComponents.prototype = {
  transform: function(ast) {
    var b = this.syntax.builders;
    var traverse = this.syntax.traverse;

    traverse(ast, {
      BlockStatement: function(block) {
        if (!isUITable(block)) { return };
        if (!block.program) { throw new Error("Invalid program"); }
        if (block.program.blockParams.length !== 1) { throw new Error("Invalid block params"); }

        var table = transformTable(b, block);

        return table;
      }
    });

    return ast;
  }
};

function transformTable(b, table) {
  var tableBlockParam = table.program.blockParams[0];
  var layoutPathStr = tableBlockParam + '.layout';

  var layoutNodes = table.program.body.filter(function(node) {
    return isUILayout(node, layoutPathStr);
  });

  var layouts = layoutNodes.map(function(layoutNode) {
    return buildLayout(b, tableBlockParam, layoutNode);
  });

  var breakpoints = layouts.map(function(layout) {
    return findPropertyValue(layout.hash.pairs, 'breakpoint');
  });

  // Passes array of breakpoints
  // {{#ui-table breakpoints=(w "default" "mobile")
  table.hash.pairs.push(b.pair('breakpoints',
    b.sexpr('w', breakpoints)
  ));

  table.program.body = layouts;

  return table;
}

function buildLayout(b, tableBlockParam, block) {
  // TODO: Use Layout block param instead
  var columnPathStr = tableBlockParam + '.column';
  var dataPathStr = tableBlockParam + '.data';
  var rowPathStr = tableBlockParam + '.row';
  var rowCellPathStr = tableBlockParam + '.row-cell';
  var headerPathStr = tableBlockParam + '.header';
  var headerCellPathStr = tableBlockParam + '.header-cell';

  var columnNodes = block.program.body.filter(function(node) {
    return isUIColumn(node, columnPathStr);
  });

  var bodyRowCells = columnNodes.map(function(column) {
    return b.block(rowCellPathStr, null, column.hash, b.program(
      column.program.body
    ));
  });

  var headerRow = b.block(headerPathStr, null, null, b.program(
    columnNodes.map(function(column) {
      var name = findPropertyValue(column.hash.pairs, 'name').value;
      return b.block(headerCellPathStr, null, column.hash, b.program([b.text(name)]));
    })
  ));

  // TODO: A better way to determine the block param to assign the data hash
  // for each item to
  var columnBlockParam = columnNodes[0].program.blockParams[0];

  var dataItemHash = b.sexpr('hash', null, b.hash([
    b.pair('data', b.path('-data-item'))
  ]));

  // {{#each t.data as |-data-item|}}
  //   {{#with (hash data=-data-item) as |<columnBlockParam>|}}
  //     ... body
  //   {{/with}}
  // {{/each}}
  var bodyRows = b.block('each', [b.path(dataPathStr)], null,
    b.program([
      b.block('with', [dataItemHash], null,
        b.program([
          b.block(rowPathStr, null, null, b.program(bodyRowCells))
        ], [columnBlockParam])
      )
    ],
    ['-data-item']
  ));

  block.program.body = [headerRow, bodyRows];

  return block;
}

function isUILayout(node, pathStr) {
  return node.type === 'BlockStatement' && node.path.original === pathStr;
}

function isUIColumn(node, pathStr) {
  return node.type === 'BlockStatement' && node.path.original === pathStr;
}

function isUITable(node) {
  return node.path.original === 'ui-table';
}

function findPropertyValue(array, property) {
  var property = array.filter(function(item) {
    return item.key === property;
  })[0];

  if (property) {
    return property.value;

  } else {
    return { value: '' };
  }
}

module.exports = TransformUITableComponents;
