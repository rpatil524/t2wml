import React from 'react';
import * as utils from './table-utils';
import { TableCell } from '../../common/dtos';


const MIN_NUM_ROWS = 100;
const CHARACTERS = [...Array(26)].map((a, i) => String.fromCharCode(97+i).toUpperCase());


interface TableProperties{
  tableData: TableCell[][];
  handleOnMouseUp: any;
  handleOnMouseDown: any;
  handleOnMouseMove: any;
  handleOnClickHeader: any;
}


class Table extends React.Component<TableProperties>{

  private tableRef = React.createRef<HTMLTableElement>();

  constructor(props: TableProperties) {
    super(props);
  }

  renderEmptyTable() {
    const {
      onMouseUp,
      onMouseDown,
      onMouseMove,
    } = this.props;
    return (
      <div className="table-wrapper">
        <table ref={this.tableRef}
          onMouseUp={onMouseUp.bind(this)}
          onMouseDown={onMouseDown.bind(this)}
          onMouseMove={onMouseMove.bind(this)}>
          <thead>
            <tr>
              <th></th>
              {CHARACTERS.map(c => <th key={c}><div>{c}</div></th>)}
            </tr>
          </thead>
          <tbody>
            {[...Array(MIN_NUM_ROWS)].map((e, i) => (
              <tr key={`row-${i}`}>
                <td>{i+1}</td>
                {CHARACTERS.map((c, j) => (
                  <td key={`cell-${j}`}></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  render() {
    const {
      tableData,
      onMouseUp,
      onMouseDown,
      onMouseMove,
      onClickHeader,
    } = this.props;

    if ( !tableData ) {
      return this.renderEmptyTable();
    }

    const rows = [...Array(Math.max(tableData.length, MIN_NUM_ROWS))];
    const cols = [...Array(Math.max(tableData[0].length, 26))];

    return (
      <div className="table-wrapper">
        <table ref={this.tableRef}
          onMouseUp={onMouseUp.bind(this)}
          onMouseDown={onMouseDown.bind(this)}
          onMouseMove={onMouseMove.bind(this)}>
          <thead>
            <tr>
              <th></th>
              {cols.map((r, i) => (
                <th key={i}>
                  <div onDoubleClick={onClickHeader.bind(this)}>
                    {utils.columnToLetter(i + 1)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={`row-${i}`}>
                <td>{i+1}</td>
                {cols.map((r, j) => {
                  if ( i < tableData.length && j < tableData[i].length ) {
                    const cell = tableData[i][j];
                    return (
                      <td key={`cell-${j}`}
                        className={cell.classNames.join(' ')}>
                        {cell.content}
                      </td>
                    )
                  } else {
                    return <td key={`cell-${j}`} />
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}


export default Table
