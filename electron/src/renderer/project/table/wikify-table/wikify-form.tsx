import React from 'react';

import * as utils from '../table-utils';
import { Button, Col, Form, Row } from 'react-bootstrap';


interface WikifyFormProperties {
  selectedCell: Cell | null;
  onChange: any | null, // Use the actual function type: (arg: argType) => returnType
  onSubmit: any | null,
}


interface WikifyFormState {
  qnode?: string,
}


class WikifyForm extends React.Component<WikifyFormProperties, WikifyFormState> {

  constructor(props: WikifyFormProperties) {
    super(props);

    this.state = {
      qnode: '',
    };
  }

  handleOnChange(event: any, key: string) {
    const { onChange } = this.props;
    const value = (event.target as HTMLInputElement).value;
    const updatedState: { [key: string]: string; } = {};
    updatedState[key] = value;
    this.setState({ ...updatedState }, () => onChange(key, value));
  }

  handleOnSubmit(event: any) {
    event.preventDefault();
    const { onSubmit } = this.props;
    onSubmit(this.state);
  }

  renderSelectionAreas() {
    const { selectedCell } = this.props;
    if (!selectedCell) { return null; }
    const { col, row } = selectedCell;
    return (
      <p className="area">
        Selected: {utils.columnToLetter(col + 1)}{row + 1}
      </p>
    )
  }

  renderTextInput() {
    return (
      <Form.Group as={Row}
        onChange={(event: React.KeyboardEvent) => this.handleOnChange(event, 'qnode')}>
        <Col sm="12" md="12">
          <Form.Label className="text-muted">qnode</Form.Label>
          <Form.Control type="text" placeholder="qnode" size="sm" />
        </Col>
      </Form.Group>
    )
  }

  renderSubmitButton() {
    return (
      <Form.Group as={Row}>
        <Col sm="12" md="12">
          <Button
            size="sm"
            type="submit"
            variant="outline-dark">
            Submit
          </Button>
        </Col>
      </Form.Group>
    )
  }

  render() {
    return (
      <Form className="container wikify-form"
        onSubmit={this.handleOnSubmit.bind(this)}>
        {this.renderSelectionAreas()}
        {this.renderTextInput()}
        {this.renderSubmitButton()}
      </Form>
    )
  }
}


export default WikifyForm;
