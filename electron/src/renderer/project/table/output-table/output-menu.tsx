import React from 'react';

import './output-menu.css';

import Draggable from 'react-draggable';
import { Toast } from 'react-bootstrap';
import * as utils from '../table-utils';
import { ErrorMessage } from '../../../common/general';


interface OutputMenuProperties {
  selectedCell: Cell | null;
  position?: Array<number>,
  onDelete: any | null,
  onClose: any | null,
}


interface OutputMenuState {
  errorMessage: ErrorMessage;
}


class OutputMenu extends React.Component<OutputMenuProperties, OutputMenuState> {


  constructor(props: OutputMenuProperties) {
    super(props);

    this.state = {
      errorMessage: {} as ErrorMessage,
    };
  }

  renderHeader() {
    const { selectedCell } = this.props;

    let text = 'Selected:';
    const selection: CellSelection = {
      x1: selectedCell.col + 1,
      x2: selectedCell.col + 1,
      y1: selectedCell.row + 1,
      y2: selectedCell.row + 1,
    };
    text += ` ${utils.humanReadableSelection(selection)}`;

    return (
      <Toast.Header className="handle">
        <strong className="mr-auto">{text}</strong>
      </Toast.Header>
    )
  }

  render() {
    const { position, onClose } = this.props;
    return (
      <Draggable handle=".handle"
        defaultPosition={{x: position[0], y: position[1]}}>
        <div className="output-menu">
          <Toast onClose={onClose}>
            {this.renderHeader()}
            <Toast.Body>
            </Toast.Body>
          </Toast>
        </div>
      </Draggable>
    )
  }
}


export default OutputMenu
