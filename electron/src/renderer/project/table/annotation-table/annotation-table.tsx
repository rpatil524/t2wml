//fills in tabledata and the mouse events, renders a "table" with those properties

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import Table from '../table';
import { IReactionDisposer, reaction } from 'mobx';
import wikiStore from '@/renderer/data/store';
import { AnnotationBlock, TableCell, TableDTO } from '../../../common/dtos';
import { CellSelection, ErrorMessage } from '../../../common/general';
import { config } from '../../../../main/config';
import AnnotationMenu from './annotation-menu';
import * as utils from '../table-utils'
import TableToast from '../table-toast';

interface TableState {
    tableData: TableCell[][];
    showAnnotationMenu: boolean,
    annotationMenuPosition?: Array<number>,
    selectedAnnotationBlock?: AnnotationBlock,
    showToast: boolean,
}

@observer
class AnnotationTable extends Component<{}, TableState> {
    private tableRef = React.createRef<HTMLTableElement>().current!;
    private prevElement?: EventTarget;
    private prevDirection?: 'up' | 'down' | 'left' | 'right';
    private selecting = false;
    private selections: CellSelection[] = [];

    setTableReference(reference?: HTMLTableElement) {
        if (!reference) { return; }
        this.tableRef = reference;
    }

    constructor(props: {}) {
        super(props);

        // init state
        this.state = {
            tableData: null,
            showAnnotationMenu: false,
            annotationMenuPosition: [50, 70],
            selectedAnnotationBlock: undefined,
            showToast: false,
        };
    }

    private disposers: IReactionDisposer[] = [];

    componentDidMount() {
        this.updateTableData(wikiStore.table.table);
        document.addEventListener('keydown', (event) => this.handleOnKeyDown(event));

        this.disposers.push(reaction(() => wikiStore.table.table, (table) => this.updateTableData(table)));
        this.disposers.push(reaction(() => wikiStore.annotations.blocks, () => this.updateAnnotationBlocks()));
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', (event) => this.handleOnKeyDown(event));
        for (const disposer of this.disposers) {
            disposer();
        }
    }

    updateTableData(table?: TableDTO) {
        if (!table || !table.cells) { return; }
        const tableData = [];
        for (let i = 0; i < table.cells.length; i++) {
            const rowData = [];
            for (let j = 0; j < table.cells[i].length; j++) {
                const cell: TableCell = {
                    content: table.cells[i][j],
                    classNames: [],
                };
                rowData.push(cell);
            }
            tableData.push(rowData);
        }
        this.updateAnnotationBlocks(tableData)
    }

    checkSelectedAnnotationBlocks(selection: CellSelection) {
        const { x1, x2, y1, y2 } = selection;
        for (const block of wikiStore.annotations.blocks) {
            for (const selection of block.selections) {
                if (selection['y1'] <= selection['y2']) {
                    if (selection['x1'] <= selection['x2']) {
                        if (x1 >= selection['x1'] &&
                            x2 <= selection['x2'] &&
                            y1 >= selection['y1'] &&
                            y2 <= selection['y2']) {
                            this.resetSelections();
                            this.selections = block.selections;
                            this.updateSelections();
                            this.setState({ selectedAnnotationBlock: block });
                            return true;
                        }
                    } else {
                        if (x1 <= selection['x1'] &&
                            x2 >= selection['x2'] &&
                            y1 >= selection['y1'] &&
                            y2 <= selection['y2']) {
                            this.resetSelections();
                            this.selections = block.selections;
                            this.updateSelections();
                            this.setState({ selectedAnnotationBlock: block });
                            return true;
                        }
                    }
                } else {
                    if (selection['x1'] <= selection['x2']) {
                        if (x1 >= selection['x1'] &&
                            x2 <= selection['x2'] &&
                            y1 <= selection['y1'] &&
                            y2 >= selection['y2']) {
                            this.resetSelections();
                            this.selections = block.selections;
                            this.updateSelections();
                            this.setState({ selectedAnnotationBlock: block });
                            return true;
                        }
                    } else {
                        if (x1 <= selection['x1'] &&
                            x2 >= selection['x2'] &&
                            y1 <= selection['y1'] &&
                            y2 >= selection['y2']) {
                            this.resetSelections();
                            this.selections = block.selections;
                            this.updateSelections();
                            this.setState({ selectedAnnotationBlock: block });
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }


    updateAnnotationBlocks(tableData?: TableCell[][]) {
        if (!tableData) {
            const { tableData } = this.state;
        }
        if (wikiStore.annotations.blocks) {
            for (const block of wikiStore.annotations.blocks) {
                const { role, type, selections } = block;
                const classNames: string[] = [];
                if (role) {
                    classNames.push(`role-${role}`);
                }
                if (type) {
                    classNames.push(`type-${type}`);
                }
                for (const selection of selections) {
                    const { x1, y1, x2, y2 } = selection;
                    if (y1 <= y2) {
                        if (x1 <= x2) {
                            for (let row = y1; row <= y2; row++) {
                                for (let col = x1; col <= x2; col++) {
                                    const cell = tableData[row - 1][col - 1];
                                    cell.classNames = classNames;
                                }
                            }
                        } else {
                            for (let row = y1; row <= y2; row++) {
                                for (let col = x2; col <= x1; col++) {
                                    const cell = tableData[row - 1][col - 1];
                                    cell.classNames = classNames;
                                }
                            }
                        }
                    } else {
                        if (x1 <= x2) {
                            for (let row = y2; row <= y1; row++) {
                                for (let col = x1; col <= x2; col++) {
                                    const cell = tableData[row - 1][col - 1];
                                    cell.classNames = classNames;
                                }
                            }
                        } else {
                            for (let row = y2; row <= y1; row++) {
                                for (let col = x2; col <= x1; col++) {
                                    const cell = tableData[row - 1][col - 1];
                                    cell.classNames = classNames;
                                }
                            }
                        }
                    }
                }
            }
        }
        this.setState({ tableData });
    }

    deleteAnnotationBlock(block: AnnotationBlock) {
        const { tableData } = this.state;
        for (const selection of block.selections) {
            const { x1, y1, x2, y2 } = selection;
            if (y1 <= y2) {
                if (x1 <= x2) {
                    for (let row = y1; row <= y2; row++) {
                        for (let col = x1; col <= x2; col++) {
                            const cell = tableData[row - 1][col - 1];
                            cell.classNames = [];
                        }
                    }
                } else {
                    for (let row = y1; row <= y2; row++) {
                        for (let col = x2; col <= x1; col++) {
                            const cell = tableData[row - 1][col - 1];
                            cell.classNames = [];
                        }
                    }
                }
            } else {
                if (x1 <= x2) {
                    for (let row = y2; row <= y1; row++) {
                        for (let col = x1; col <= x2; col++) {
                            const cell = tableData[row - 1][col - 1];
                            cell.classNames = [];
                        }
                    }
                } else {
                    for (let row = y2; row <= y1; row++) {
                        for (let col = x2; col <= x1; col++) {
                            const cell = tableData[row - 1][col - 1];
                            cell.classNames = [];
                        }
                    }
                }
            }
        }
        this.setState({ tableData });
    }

    resetSelections() {
        const table = this.tableRef;
        if (table) {
            table.querySelectorAll('td[class*="active"]').forEach(e => {
                e.classList.forEach(className => {
                    if (className.startsWith('active')) {
                        e.classList.remove(className);
                    }
                });
            });
            table.querySelectorAll('.cell-border-top').forEach(e => e.remove());
            table.querySelectorAll('.cell-border-left').forEach(e => e.remove());
            table.querySelectorAll('.cell-border-right').forEach(e => e.remove());
            table.querySelectorAll('.cell-border-bottom').forEach(e => e.remove());
            table.querySelectorAll('.cell-resize-corner').forEach(e => e.remove());
        }
    }

    updateSelections() {
        const { selectedAnnotationBlock: selectedBlock } = this.state;
        const table: any = this.tableRef;
        if (!table) { return; }

        // Reset selections before update
        this.resetSelections();

        const classNames: string[] = [];
        if (selectedBlock) {
            const { role, type } = selectedBlock;
            if (role) {
                classNames.push(`active-role-${role}`);
            }
            if (type) {
                classNames.push(`active-type-${type}`);
            }
        }
        const rows = table.querySelectorAll('tr');
        this.selections.forEach(selection => {
            const { x1, x2, y1, y2 } = selection;
            const leftCol = Math.min(x1, x2);
            const rightCol = Math.max(x1, x2);
            const topRow = Math.min(y1, y2);
            const bottomRow = Math.max(y1, y2);
            let rowIndex = topRow;
            while (rowIndex <= bottomRow) {
                let colIndex = leftCol;
                while (colIndex <= rightCol) {
                    this.selectCell(
                        rows[rowIndex].children[colIndex],
                        rowIndex,
                        colIndex,
                        topRow,
                        leftCol,
                        rightCol,
                        bottomRow,
                        classNames,
                    );
                    colIndex += 1;
                }
                rowIndex += 1;
            }
        });
    }

    checkSelectionOverlaps() {
        this.selections.map((selection, i) => {
            const { x1, y1, x2, y2 } = selection;

            // Get the coordinates of the sides
            const aTop = y1 <= y2 ? y1 : y2;
            const aLeft = x1 <= x2 ? x1 : x2;
            const aRight = x2 >= x1 ? x2 : x1;
            const aBottom = y2 >= y1 ? y2 : y1;

            for (let j = 0; j < this.selections.length; j++) {
                if (j !== i) {
                    const area = this.selections[j];

                    // Get the coordinates of the sides
                    const bTop = area.y1 <= area.y2 ? area.y1 : area.y2;
                    const bLeft = area.x1 <= area.x2 ? area.x1 : area.x2;
                    const bRight = area.x2 >= area.x1 ? area.x2 : area.x1;
                    const bBottom = area.y2 >= area.y1 ? area.y2 : area.y1;

                    // check for no-collisions between area A and B
                    if (aTop > bBottom) {
                        continue;
                    }
                    if (aBottom < bTop) {
                        continue;
                    }
                    if (aLeft > bRight) {
                        continue;
                    }
                    if (aRight < bLeft) {
                        continue;
                    }

                    if (bTop <= aTop &&
                        bLeft <= aLeft &&
                        bRight >= aRight &&
                        bBottom >= aBottom) {
                        this.selections.splice(i, 1);
                    } else {
                        this.selections.splice(j, 1);
                    }
                    this.updateSelections();
                    break;
                }
            }
        });
    }

    selectCell(cell: Element, rowIndex: number, colIndex: number, topRow: number, leftCol: number, rightCol: number, bottomRow: number, classNames: string[] = []) {
        // Activate the current cell
        cell.classList.add('active');
        classNames.map(className => cell.classList.add(className));

        // Add a top border to the cells at the top of the selection
        if (rowIndex === topRow) {
            const borderTop = document.createElement('div');
            borderTop.classList.add('cell-border-top');
            cell.appendChild(borderTop);
        }

        // Add a left border to the cells on the left of the selection
        if (colIndex === leftCol) {
            const borderLeft = document.createElement('div');
            borderLeft.classList.add('cell-border-left');
            cell.appendChild(borderLeft);
        }

        // Add a right border to the cells on the right of the selection
        if (colIndex === rightCol) {
            const borderRight = document.createElement('div');
            borderRight.classList.add('cell-border-right');
            cell.appendChild(borderRight);
        }

        // Add a bottom border to the cells at the bottom of the selection
        if (rowIndex === bottomRow) {
            const borderBottom = document.createElement('div');
            borderBottom.classList.add('cell-border-bottom');
            cell.appendChild(borderBottom);
        }

        if (rowIndex === bottomRow && colIndex === rightCol) {
            const resizeCorner = document.createElement('div');
            resizeCorner.classList.add('cell-resize-corner');
            cell.appendChild(resizeCorner);
        }
    }

    openAnnotationMenu(event: React.MouseEvent) {
        let { pageX, pageY } = event;
        pageX = pageX < 50 ? 50 : pageX + 25;
        pageY = pageY < 50 ? 50 : pageY + 25;
        this.setState({
            showAnnotationMenu: true,
            annotationMenuPosition: [pageX, pageY],
        });
    }

    handleOnMouseUp(event: React.MouseEvent) {
        this.selecting = false;
        if (this.selections) {
            this.checkSelectionOverlaps();
            this.openAnnotationMenu(event);
        }
    }

    handleOnMouseDown(event: React.MouseEvent) {
        const element = event.target as any;

        // Set both coordinates to the same cell
        const x1: number = element.cellIndex;
        const x2: number = element.cellIndex;
        const y1: number = element.parentElement.rowIndex;
        const y2: number = element.parentElement.rowIndex;
        const selection: CellSelection = { x1, x2, y1, y2 };

        // check if the user is selecting an annotation block
        this.setState({
            showAnnotationMenu: false,
            selectedAnnotationBlock: undefined,
        });
        const selectedBlock = this.checkSelectedAnnotationBlocks(selection);
        if (selectedBlock) { return; }

        // Activate the selection mode
        this.selecting = true;

        // Update selection coordinates
        if ((config.platform === 'mac' && event.metaKey) ||
            (config.platform === 'linux' && event.ctrlKey) ||
            (config.platform === 'windows' && event.ctrlKey)) {

            // Add a new selection separately
            this.selections.push({ x1, x2, y1, y2 });

            // Activate the element on click
            this.selectCell(element, y1, x1, y1, x1, x1, y1);
        } else {

            // Extend the previous selection if user is holding down Shift key
            if (event.shiftKey && !!this.selections.length) {
                const prevSelection = this.selections[this.selections.length - 1];

                // Extend the previous selection left or right
                if (x1 !== prevSelection['x1']) {
                    if (x1 < prevSelection['x1']) {
                        prevSelection['x1'] = x1;
                    } else {
                        prevSelection['x2'] = x1;
                    }
                }

                // Extend the previous selection up or down
                if (y1 !== prevSelection['y1']) {
                    if (y1 < prevSelection['y1']) {
                        prevSelection['y1'] = y1;
                    } else {
                        prevSelection['y2'] = y1;
                    }
                }

                this.updateSelections();
            } else {
                this.resetSelections();
                this.selections = [{ x1, x2, y1, y2 }];

            }
        }

        // Initialize the previous element with the one selected
        this.prevElement = element;

    }

    handleOnMouseMove(event: React.MouseEvent) {
        const element = event.target as any;
        if (element === this.prevElement) { return; }

        if (this.selecting && !event.shiftKey) {

            // TODO - deal with toasts
            // Show the updated selection while moving
            // this.setState({ showToast: element.nodeName === 'TD' });

            // Update the last x coordinate of the selection
            const x2 = element.cellIndex;
            this.selections[this.selections.length - 1]['x2'] = x2;

            // Update the last y coordinate of the selection
            const y2 = element.parentElement.rowIndex;
            this.selections[this.selections.length - 1]['y2'] = y2;

            // Update selections
            this.updateSelections();

            // Update reference to the previous element
            this.prevElement = element;
        }
    }

    handleOnClickHeader(event: React.MouseEvent) {
        const element = event.target as any;
        element.setAttribute('style', 'width: 100%;');
        element.parentElement.setAttribute('style', 'max-width: 1%');

        const table: any = this.tableRef;
        const rows = table!.querySelectorAll('tr');
        const index = element.parentElement.cellIndex;
        rows.forEach((row: any) => {
            row.children[index].setAttribute('style', 'max-width: 1%');
        });

        setTimeout(() => {
            element.setAttribute('style', `min-width: ${element.clientWidth}px`);
        }, 100);
    }

    handleOnKeyDown(event: KeyboardEvent) {

        if ([37, 38, 39, 40].includes(event.keyCode) &&
            !!this.selections.length) {

            event.preventDefault();
            const { x1, x2, y1, y2 } = this.selections[0];
            const table: any = this.tableRef;
            const rows = table!.querySelectorAll('tr');

            // arrow up
            if (event.keyCode == 38 && y1 > 1) {
                this.resetSelections();
                const nextElement = rows[y1 - 1].children[x1];
                if (event.shiftKey) {
                    if (y1 === y2) {
                        this.selections = [{ 'x1': x1, 'x2': x2, 'y1': y1 - 1, 'y2': y2 }];
                        this.prevDirection = 'up';
                    } else {
                        if (this.prevDirection === 'down') {
                            this.selections = [{ 'x1': x1, 'x2': x2, 'y1': y1, 'y2': y2 - 1 }];
                        } else {
                            this.selections = [{ 'x1': x1, 'x2': x2, 'y1': y1 - 1, 'y2': y2 }];
                            this.prevDirection = 'up';
                        }
                    }
                    this.updateSelections();
                } else {
                    this.selections = [{ 'x1': x1, 'x2': x1, 'y1': y1 - 1, 'y2': y1 - 1 }];
                    this.selectCell(nextElement, y1 - 1, x1, y1 - 1, x1, x1, y1 - 1);
                    const selection: CellSelection = { 'x1': x1, 'x2': x1, 'y1': y1 - 1, 'y2': y1 - 1 };
                    const selectedBlock = this.checkSelectedAnnotationBlocks(selection);
                    if (selectedBlock) {
                        this.setState({ showAnnotationMenu: true });
                    }
                }
                this.prevElement = nextElement;
            }

            // arrow down
            if (event.keyCode == 40 && y1 < rows.length - 1) {
                this.resetSelections();
                const nextElement = rows[y1 + 1].children[x1];
                if (event.shiftKey) {
                    if (y1 === y2) {
                        this.selections = [{ 'x1': x1, 'x2': x2, 'y1': y1, 'y2': y2 + 1 }];
                        this.prevDirection = 'down';
                    } else {
                        if (this.prevDirection === 'up') {
                            this.selections = [{ 'x1': x1, 'x2': x2, 'y1': y1 + 1, 'y2': y2 }];
                        } else {
                            this.selections = [{ 'x1': x1, 'x2': x2, 'y1': y1, 'y2': y2 + 1 }];
                            this.prevDirection = 'down';
                        }
                    }
                    this.updateSelections();
                } else {
                    this.selections = [{ 'x1': x1, 'x2': x1, 'y1': y1 + 1, 'y2': y1 + 1 }];
                    this.selectCell(nextElement, y1 + 1, x1, y1 + 1, x1, x1, y1 + 1);
                    const selection: CellSelection = { 'x1': x1, 'x2': x1, 'y1': y1 + 1, 'y2': y1 + 1 };
                    const selectedBlock = this.checkSelectedAnnotationBlocks(selection);
                    if (selectedBlock) {
                        this.setState({ showAnnotationMenu: true });
                    }
                }
                this.prevElement = nextElement;
            }

            // arrow left
            if (event.keyCode == 37 && x1 > 1) {
                this.resetSelections();
                const nextElement = rows[y1].children[x1 - 1];
                if (event.shiftKey) {
                    if (x1 === x2) {
                        this.selections = [{ 'x1': x1 - 1, 'x2': x2, 'y1': y1, 'y2': y2 }];
                        this.prevDirection = 'left';
                    } else {
                        if (this.prevDirection === 'right') {
                            this.selections = [{ 'x1': x1, 'x2': x2 - 1, 'y1': y1, 'y2': y2 }];
                        } else {
                            this.selections = [{ 'x1': x1 - 1, 'x2': x2, 'y1': y1, 'y2': y2 }];
                            this.prevDirection = 'left';
                        }
                    }
                    this.updateSelections();
                } else {
                    this.selections = [{ 'x1': x1 - 1, 'x2': x1 - 1, 'y1': y1, 'y2': y1 }];
                    this.selectCell(nextElement, y1, x1 - 1, y1, x1 - 1, x1 - 1, y1);
                    const selection: CellSelection = { 'x1': x1 - 1, 'x2': x1 - 1, 'y1': y1, 'y2': y1 };
                    const selectedBlock = this.checkSelectedAnnotationBlocks(selection);
                    if (selectedBlock) {
                        this.setState({ showAnnotationMenu: true });
                    }
                }
                this.prevElement = nextElement;
            }

            // arrow right
            if (event.keyCode == 39 && x1 < rows[y1].children.length - 1) {
                this.resetSelections();
                const nextElement = rows[y1].children[x1 + 1];
                if (event.shiftKey) {
                    if (x1 === x2) {
                        this.selections = [{ 'x1': x1, 'x2': x2 + 1, 'y1': y1, 'y2': y2 }];
                        this.prevDirection = 'right';
                    } else {
                        if (this.prevDirection === 'left') {
                            this.selections = [{ 'x1': x1 + 1, 'x2': x2, 'y1': y1, 'y2': y2 }];
                        } else {
                            this.selections = [{ 'x1': x1, 'x2': x2 + 1, 'y1': y1, 'y2': y2 }];
                            this.prevDirection = 'right';
                        }
                    }
                    this.updateSelections();
                } else {
                    this.selections = [{ 'x1': x1 + 1, 'x2': x1 + 1, 'y1': y1, 'y2': y1 }];
                    this.selectCell(nextElement, y1, x1 + 1, y1, x1 + 1, x1 + 1, y1);
                    const selection: CellSelection = { 'x1': x1 + 1, 'x2': x1 + 1, 'y1': y1, 'y2': y1 };
                    const selectedBlock = this.checkSelectedAnnotationBlocks(selection);
                    if (selectedBlock) {
                        this.setState({ showAnnotationMenu: true });
                    }
                }
                this.prevElement = nextElement;
            }

            // Show the updated selection while moving
            // TODO
            //this.setState({showToast: true});
        }
    }



    closeAnnotationMenu() {
        this.setState({
            showAnnotationMenu: false,
            selectedAnnotationBlock: undefined,
        }, () => this.resetSelections());
    }

    renderAnnotationMenu() {
        const {
            showAnnotationMenu,
            annotationMenuPosition,
            selectedAnnotationBlock,
        } = this.state;
        if (showAnnotationMenu) {
            return (
                <AnnotationMenu
                    selections={this.selections}
                    position={annotationMenuPosition}
                    selectedAnnotationBlock={selectedAnnotationBlock}
                    onDelete={this.deleteAnnotationBlock.bind(this)}
                    onClose={() => this.closeAnnotationMenu()} />
            )
        }
    }

    renderTable() {
        return (
            <Table
                tableData={this.state.tableData}
                onMouseUp={this.handleOnMouseUp.bind(this)}
                onMouseDown={this.handleOnMouseDown.bind(this)}
                onMouseMove={this.handleOnMouseMove.bind(this)}
                onClickHeader={this.handleOnClickHeader.bind(this)}
                setTableReference={this.setTableReference.bind(this)} />
        )

    }

    onCloseToast() {
        this.setState({ showToast: false });
    }

    renderToast() {
        const { showToast } = this.state;
        if (showToast) {
            let text = 'Selected:';
            if (this.selections) {
                this.selections.forEach(selection => {
                    text += ` ${utils.humanReadableSelection(selection)}`;
                });
            }
            return (
                <TableToast
                    text={text}
                    qnode={null}
                    onClose={() => this.onCloseToast()}
                />
            )
        }
    }

    render() {
        return <div>
            {this.renderToast()}
            {this.renderTable()}
            {this.renderAnnotationMenu()}
        </div>
    }
}

export default AnnotationTable;