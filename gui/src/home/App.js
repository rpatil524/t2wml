import React from 'react';
import './App.css';
import { DEFAULT_BACKEND_SERVER } from '../config.js';
import * as utils from '../utils'
import T2WMLLogo from '../index/T2WMLLogo'

// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencilAlt, faCloudDownloadAlt, faSearch, faSortUp, faSortDown, faTrashAlt, faUser } from '@fortawesome/free-solid-svg-icons'

// App
import { Button, Card, Col, Form, FormControl, Image, InputGroup, Modal, Nav, Navbar, NavDropdown, OverlayTrigger, Row, Spinner, Table, Tooltip } from 'react-bootstrap';

// console.log
const LOG = {
  default: "background: ; color: ",
  highlight: "background: yellow; color: black",
  link: "background: white; color: blue"
};

class App extends React.Component {
  constructor(props) {
    super(props);

    // fetch data from flask
    const { userData } = this.props;

    // init global variables
    window.server = DEFAULT_BACKEND_SERVER;
    // window.sparqlEndpoint = DEFAULT_SPARQL_ENDPOINT;

    // init state
    this.state = {

      // appearance
      showSettings: false,
      showSpinner: true,
      showCreateProject: false,
      showDeleteProject: false,
      showDownloadProject: false,
      showRenameProject: false,
      deletingPid: "",
      downloadingPid: "",

      // user
      userData: userData,

      // temp in form
      tempCreateProject: "Untitled project",
      isTempCreateProjectVaild: true,
      tempRenamePid: null,
      tempRenameProject: "Untitled project",
      isTempRenameProjectVaild: true,
      tempSearch: "",

      // projects
      projectData: [],
      // projectData: [
      //   { pid: "4444", ptitle: "Project 4", cdate: 1566282771986, mdate: 1566282771986 },
      //   { pid: "1111", ptitle: "Project 1", cdate: 1565807259582, mdate: 1565807259582 },
      //   { pid: "2222", ptitle: "Project 2", cdate: 1565720859582, mdate: 1565720859582 },
      //   { pid: "3333", ptitle: "Project 3", cdate: 1563906459582, mdate: 1563906459582 },
      // ],
      sortBy: "mdate",
      isAscending: false,

    };
  }

  componentDidMount() {
    // fetch project meta
    console.log("<App> -> %c/get_project_meta%c for project list", LOG.link, LOG.default);
    fetch(window.server + "/get_project_meta", {
      mode: "cors",
      method: "POST"
    }).then(response => {
      if (!response.ok) throw Error(response.statusText);
      return response;
    }).then(response => {
      return response.json();
    }).then(json => {
      console.log("<App> <- %c/get_project_meta%c with:", LOG.link, LOG.default);
      console.log(json);

      // do something here
      if (json !== null) {
        // success
        this.setState({ projectData: json });
        this.handleSortProjects("mdate", false);
      } else {
        // failure
        throw Error("Session doesn't exist or invalid request");
      }

      // follow-ups (success)
      this.setState({ showSpinner: false });

    }).catch((error) => {
      console.log(error);
      alert("Cannot fetch project details!\n\n" + error);

      // follow-ups (failure)
      // this.setState({ showSpinner: false });
      this.handleLogout();
    });
  }

  handleCreateProject(event) {
    let ptitle = this.state.tempCreateProject.trim();
    if (ptitle === "") ptitle = "Untitled project";

    // before sending request
    this.setState({ showSpinner: true });

    // send request
    console.log("<App> -> %c/create_project%c to create project: %c" + ptitle, LOG.link, LOG.default, LOG.highlight);
    let formData = new FormData();
    formData.append("ptitle", ptitle);
    fetch(window.server + "/create_project", {
      mode: "cors",
      body: formData,
      method: "POST"
    }).then(response => {
      if (!response.ok) throw Error(response.statusText);
      return response;
    }).then(response => {
      return response.json();
    }).then(json => {
      console.log("<App> <- %c/create_project%c with:", LOG.link, LOG.default);
      console.log(json);

      // do something here
      if (json["pid"]) {
        // success
        window.location.href = window.server + "/project/" + json["pid"];
      } else {
        // failure
        throw Error("Session doesn't exist or invalid request");
      }

      // follow-ups (success)
      this.setState({ showCreateProject: false, showSpinner: false });

    }).catch((error) => {
      // console.log(error);
      alert("Cannot create new project!\n\n" + error);

      // follow-ups (failure)
      this.setState({ showCreateProject: false, showSpinner: false });
      this.handleLogout();
    });
  }

  handleDeleteProject(pid = "") {
    if (pid === "") {
      pid = this.state.deletingPid;
      if (pid === "") return;
    }

    // before sending request
    this.setState({ showSpinner: true, showDeleteProject: false });

    // send request
    console.log("<App> -> %c/delete_project%c to delete project with pid: %c" + pid, LOG.link, LOG.default, LOG.highlight);
    let formData = new FormData();
    formData.append("pid", pid);
    fetch(window.server + "/delete_project", {
      mode: "cors",
      body: formData,
      method: "POST"
    }).then(response => {
      if (!response.ok) throw Error(response.statusText);
      return response;
    }).then(response => {
      return response.json();
    }).then(json => {
      console.log("<App> <- %c/delete_project%c with:", LOG.link, LOG.default);
      console.log(json);

      // do something here
      if (json !== null) {
        // success
        const { sortBy, isAscending } = this.state;
        this.handleSortProjects(sortBy, isAscending, json);
      } else {
        // failure
        throw Error("Session doesn't exist or invalid request")
      }

      // follow-ups (success)
      this.setState({ showSpinner: false });

    }).catch((error) => {
      // console.log(error);
      alert("Cannot delete project!\n\n" + error);

      // follow-ups (failure)
      this.setState({ showSpinner: false });
    });
  }

  handleDownloadProject(pid = "") {
    if (pid === "") {
      pid = this.state.downloadingPid;
      if (pid === "") return;
    }

    // before sending request
    this.setState({ showDownloadProject: false });

    // send request
    console.log("<App> -> %c/download_project%c to download all files in project with pid: %c" + pid, LOG.link, LOG.default, LOG.highlight);
    let formData = new FormData();
    formData.append("pid", pid);
    fetch(window.server + "/download_project", {
      mode: "cors",
      body: formData,
      method: "POST"
    }).then(response => {
      if (!response.ok) throw Error(response.statusText);
      return response;
    }).then(response => {
      return response.json();
    }).then(json => {
      console.log("<App> <- %c/download_project%c with:", LOG.link, LOG.default);
      console.log(json);

      // do something here
      if (json !== null) {
        // success
        // TODO: download all files

      } else {
        // failure
        throw Error("Session doesn't exist or invalid request")
      }

      // follow-ups (success)
      this.setState({ showSpinner: false });

    }).catch((error) => {
      // console.log(error);
      alert("Cannot download project!\n\n" + error);

      // follow-ups (failure)
      // nothing
    });
  }

  handleLogout() {
    window.location.href = window.server + "/logout";
  }

  handleRenameProject(event) {
    let pid = this.state.tempRenamePid;
    let ptitle = this.state.tempRenameProject.trim();
    if (ptitle === "") ptitle = "Untitled project";

    // before sending request
    this.setState({ showSpinner: true });

    // send request
    console.log("<App> -> %c/rename_project%c to rename project %c" + pid + "%c as %c" + ptitle, LOG.link, LOG.default, LOG.highlight, LOG.default, LOG.highlight);
    let formData = new FormData();
    formData.append("pid", pid);
    formData.append("ptitle", ptitle);
    fetch(window.server + "/rename_project", {
      mode: "cors",
      body: formData,
      method: "POST"
    }).then(response => {
      if (!response.ok) throw Error(response.statusText);
      return response;
    }).then(response => {
      return response.json();
    }).then(json => {
      console.log("<App> <- %c/rename_project%c with:", LOG.link, LOG.default);
      console.log(json);

      // do something here
      if (json !== null) {
        // success
        const { sortBy, isAscending } = this.state;
        this.handleSortProjects(sortBy, isAscending, json);
      } else {
        // failure
        throw Error("Session doesn't exist or invalid request")
      }

      // follow-ups (success)
      this.setState({ showRenameProject: false, showSpinner: false });

    }).catch((error) => {
      // console.log(error);
      alert("Cannot rename project!\n\n" + error);

      // follow-ups (failure)
      this.setState({ showRenameProject: false, showSpinner: false });
    });
  }

  handleSaveSettings(event) {
    console.log("<App> updated settings");

    // update settings
    window.sparqlEndpoint = this.refs.sparqlEndpoint.value;
    this.setState({ showSettings: false });

    // notify backend
    let formData = new FormData();
    formData.append("pid", window.pid);
    formData.append("endpoint", window.sparqlEndpoint);
    fetch(window.server + "/update_setting", {
      mode: "cors",
      body: formData,
      method: "POST"
    }).catch((error) => {
      console.log(error);
    });
  }

  handleSortProjects(willSortBy, willBeAscending = null, newProjectData = null) {
    const { sortBy, isAscending } = this.state;

    // decide if it's ascending
    if (willBeAscending === null) {
      if (willSortBy === sortBy) {
        // click same header again
        willBeAscending = !isAscending;
      } else {
        // click another header, go default
        if (willSortBy === "cdate" || willSortBy === "mdate") {
          willBeAscending = false;
        } else {
          willBeAscending = true;
        }
      }
    }

    // sort
    let projectData;
    if (newProjectData !== null) {
      projectData = newProjectData;
    } else {
      projectData = this.state.projectData;
    }
    projectData.sort(function (p1, p2) {
      if (willBeAscending) {
        if (p1[willSortBy] < p2[willSortBy]) return -1;
        else if (p1[willSortBy] > p2[willSortBy]) return 1;
        else return 0;
      } else {
        if (p1[willSortBy] < p2[willSortBy]) return 1;
        else if (p1[willSortBy] > p2[willSortBy]) return -1;
        else return 0;
      }
    });

    // update state
    this.setState({
      projectData: projectData,
      sortBy: willSortBy,
      isAscending: willBeAscending,
    });
  }

  renderCreateProject() {
    return (
      <Modal show={this.state.showCreateProject} onHide={() => { /* do nothing */ }}>

        {/* loading spinner */}
        <div className="mySpinner" hidden={!this.state.showSpinner}>
          <Spinner animation="border" />
        </div>

        {/* header */}
        <Modal.Header style={{ background: "whitesmoke" }}>
          <Modal.Title>New&nbsp;Project</Modal.Title>
        </Modal.Header>

        {/* body */}
        <Modal.Body>
          <Form className="container">

            {/* project title */}
            <Form.Group as={Row} style={{ marginTop: "1rem" }} onChange={(event) => {
              this.setState({
                tempCreateProject: event.target.value,
                isTempCreateProjectVaild: utils.isValidTitle(event.target.value)
              })
            }}>
              {/* <Form.Label column sm="12" md="2" className="text-right">
                Title
              </Form.Label> */}
              <Col sm="12" md="12">
                <Form.Control
                  type="text"
                  defaultValue=""
                  placeholder={this.state.tempCreateProject}
                  autoFocus={true}
                  style={this.state.isTempCreateProjectVaild ? {} : { border: "1px solid red" }}
                  onKeyPress={(event) => {
                    if (event.key === "Enter") {
                      // if press enter (13), then do create new project
                      event.preventDefault();
                      this.handleCreateProject();
                    }
                  }}
                />
                <div className="small" style={this.state.isTempCreateProjectVaild ? { display: "none" } : { color: "red" }}>
                  <span>*&nbsp;Cannot contain any of the following characters:&nbsp;</span>
                  <code>&#92;&nbsp;&#47;&nbsp;&#58;&nbsp;&#42;&nbsp;&#63;&nbsp;&#34;&nbsp;&#60;&nbsp;&#62;&nbsp;&#124;</code>
                </div>
              </Col>
            </Form.Group>

          </Form>
        </Modal.Body>

        {/* footer */}
        <Modal.Footer style={{ background: "whitesmoke" }}>
          <Button variant="outline-dark" onClick={() => this.setState({ showCreateProject: false })} >
            Cancel
          </Button>
          <Button variant="dark" onClick={this.handleCreateProject.bind(this)} disabled={!(this.state.isTempCreateProjectVaild)}>
            Create
          </Button>
        </Modal.Footer>

      </Modal>
    );
  }

  renderDeleteProject() {
    return (
      <Modal show={this.state.showDeleteProject} onHide={() => { /* do nothing */ }}>

        {/* header */}
        <Modal.Header style={{ background: "whitesmoke" }}>
          <Modal.Title>Delete&nbsp;Project</Modal.Title>
        </Modal.Header>

        {/* body */}
        <Modal.Body>
          <Form className="container">
            <Form.Group as={Row} style={{ marginTop: "1rem" }}>
              <Col sm="12" md="12">
                <Form.Control
                  plaintext
                  readOnly
                  defaultValue={"You are about to delete this project..."}
                />
              </Col>
            </Form.Group>
          </Form>
        </Modal.Body>

        {/* footer */}
        <Modal.Footer style={{ background: "whitesmoke" }}>
          <Button variant="outline-dark" onClick={() => this.setState({ showDeleteProject: false, deletingPid: "" })} >
            Cancel
          </Button>
          <Button variant="danger" onClick={() => this.handleDeleteProject()} style={{ backgroundColor: "#990000", borderColor: "#990000" }}>
            Confirm
          </Button>
        </Modal.Footer>

      </Modal>
    );
  }

  renderDownloadProject() {
    return (
      <Modal show={this.state.showDownloadProject} onHide={() => { /* do nothing */ }}>

        {/* header */}
        <Modal.Header style={{ background: "whitesmoke" }}>
          <Modal.Title>Download&nbsp;Project</Modal.Title>
        </Modal.Header>

        {/* body */}
        <Modal.Body>
          <Form className="container">
            <Form.Group as={Row} style={{ marginTop: "1rem" }}>
              <Col sm="12" md="12">
                <Form.Control
                  plaintext
                  readOnly
                  defaultValue={"Feature not available"}
                  // defaultValue={"It might take some time to gather and compress files..."}
                />
              </Col>
            </Form.Group>
          </Form>
        </Modal.Body>

        {/* footer */}
        <Modal.Footer style={{ background: "whitesmoke" }}>
          <Button variant="outline-dark" onClick={() => this.setState({ showDownloadProject: false, downloadingPid: "" })} >
            Cancel
          </Button>
          <Button variant="dark" onClick={() => this.handleDownloadProject()} disabled>
            Start
          </Button>
        </Modal.Footer>

      </Modal>
    );
  }

  renderRenameProject() {
    return (
      <Modal show={this.state.showRenameProject} onHide={() => { /* do nothing */ }}>

        {/* loading spinner */}
        <div className="mySpinner" hidden={!this.state.showSpinner}>
          <Spinner animation="border" />
        </div>

        {/* header */}
        <Modal.Header style={{ background: "whitesmoke" }}>
          <Modal.Title>Rename&nbsp;Project</Modal.Title>
        </Modal.Header>

        {/* body */}
        <Modal.Body>
          <Form className="container">

            {/* project title */}
            <Form.Group as={Row} style={{ marginTop: "1rem" }} onChange={(event) => {
              this.setState({
                tempRenameProject: event.target.value,
                isTempRenameProjectVaild: utils.isValidTitle(event.target.value)
              })
            }}>
              <Col sm="12" md="12">
                <Form.Control
                  type="text"
                  defaultValue={this.state.tempRenameProject}
                  placeholder="Untitled project"
                  autoFocus={true}
                  style={this.state.isTempRenameProjectVaild ? {} : { border: "1px solid red" }}
                  onKeyPress={(event) => {
                    if (event.key === "Enter") {
                      // if press enter (13), then do create new project
                      event.preventDefault();
                      this.handleRenameProject();
                    }
                  }}
                />
                <div className="small" style={this.state.isTempRenameProjectVaild ? { display: "none" } : { color: "red" }}>
                  <span>*&nbsp;Cannot contain any of the following characters:&nbsp;</span>
                  <code>&#92;&nbsp;&#47;&nbsp;&#58;&nbsp;&#42;&nbsp;&#63;&nbsp;&#34;&nbsp;&#60;&nbsp;&#62;&nbsp;&#124;</code>
                </div>
              </Col>
            </Form.Group>

          </Form>
        </Modal.Body>

        {/* footer */}
        <Modal.Footer style={{ background: "whitesmoke" }}>
          <Button variant="outline-dark" onClick={() => this.setState({ showRenameProject: false })} >
            Cancel
          </Button>
          <Button variant="dark" onClick={this.handleRenameProject.bind(this)} disabled={!(this.state.isTempRenameProjectVaild)}>
            Rename
          </Button>
        </Modal.Footer>

      </Modal>
    );
  }

  renderProjects() {
    const { projectData, tempSearch } = this.state;
    const keywords = tempSearch.toLowerCase().split(/ +/);

    let projectListDiv = [];
    for (let i = 0, len = projectData.length; i < len; i++) {
      const { pid, ptitle, cdate, mdate } = projectData[i];
      if (utils.searchProject(ptitle, keywords)) {
        projectListDiv.push(
          <tr key={i}>

            {/* title */}
            <td>
              <span>
                <a
                  href={window.server + "/project/" + pid}
                  target="_self" // open project on this page
                  // target="_blank" // open project on new page
                  // rel="noopener noreferrer" // open project on new page
                  style={{ "color": "hsl(200, 100%, 30%)" }}
                >{ptitle}</a>
              </span>
              {/* <span className="text-muted small">&nbsp;[{pid}]</span> */}
            </td>

            {/* last modified */}
            <td>
              <OverlayTrigger placement="top" trigger="hover" // defaultShow="true"
                popperConfig={{ modifiers: { hide: { enabled: false }, preventOverflow: { enabled: false } } }}
                overlay={
                  <Tooltip style={{ width: "fit-content" }}>
                    <span className="text-left small">
                      {utils.timestamp2abstime(mdate)}
                    </span>
                  </Tooltip>
                }
              >
                <span style={{ display: "inline-block", cursor: "default", color: "gray" }}>{utils.timestamp2reltime(mdate)}</span>
              </OverlayTrigger>
            </td>

            {/* date created */}
            <td>
              <OverlayTrigger placement="top" trigger="hover" // defaultShow="true"
                popperConfig={{ modifiers: { hide: { enabled: false }, preventOverflow: { enabled: false } } }}
                overlay={
                  <Tooltip style={{ width: "fit-content" }}>
                    <span className="text-left small">
                      {utils.timestamp2abstime(cdate)}
                    </span>
                  </Tooltip>
                }
              >
                <span style={{ display: "inline-block", cursor: "default", color: "gray" }}>{utils.timestamp2reltime(cdate)}</span>
              </OverlayTrigger>
            </td>

            {/* actions */}
            <td>

              {/* rename */}
              <OverlayTrigger
                placement="top"
                trigger="hover"
                popperConfig={{ modifiers: { hide: { enabled: false }, preventOverflow: { enabled: false } } }}
                overlay={
                  <Tooltip style={{ width: "fit-content" }}>
                    <span className="text-left small">Rename</span>
                  </Tooltip>
                }
              >
                <span
                  className="action-duplicate"
                  style={{ display: "inline-block", width: "33%", cursor: "pointer", textAlign: "center" }}
                  onClick={() => this.setState({ showRenameProject: true, tempRenamePid: pid, tempRenameProject: ptitle })}
                >
                  <FontAwesomeIcon icon={faPencilAlt} />
                </span>
              </OverlayTrigger>

              {/* download */}
              <OverlayTrigger
                placement="top"
                trigger="hover"
                popperConfig={{ modifiers: { hide: { enabled: false }, preventOverflow: { enabled: false } } }}
                overlay={
                  <Tooltip style={{ width: "fit-content" }}>
                    <span className="text-left small">Download</span>
                  </Tooltip>
                }
              >
                <span
                  className="action-download"
                  style={{ display: "inline-block", width: "33%", cursor: "pointer", textAlign: "center" }}
                  onClick={() => this.setState({ showDownloadProject: true, downloadingPid: pid })}
                >
                  <FontAwesomeIcon icon={faCloudDownloadAlt} />
                </span>
              </OverlayTrigger>

              {/* delete */}
              <OverlayTrigger
                placement="top"
                trigger="hover"
                popperConfig={{ modifiers: { hide: { enabled: false }, preventOverflow: { enabled: false } } }}
                overlay={
                  <Tooltip style={{ width: "fit-content" }}>
                    <span className="text-left small">Delete</span>
                  </Tooltip>
                }
              >
                <span
                  className="action-delete"
                  style={{ display: "inline-block", width: "33%", cursor: "pointer", textAlign: "center" }}
                  onClick={() => this.setState({ showDeleteProject: true, deletingPid: pid })}
                >
                  <FontAwesomeIcon icon={faTrashAlt} />
                </span>
              </OverlayTrigger>
            </td>
          </tr>
        );
      }
    }
    if (projectListDiv.length === 0) {
      projectListDiv.push(
        <tr key={-1}>
          <td colSpan="4" style={{ textAlign: "center" }}>No projects</td>
        </tr>
      );
    }
    const { sortBy, isAscending } = this.state;
    return (
      <Table bordered hover responsive size="sm" style={{ fontSize: "14px" }}>
        <thead style={{ background: "whitesmoke" }}>
          <tr>

            {/* title */}
            <th style={{ width: "50%" }}>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => this.handleSortProjects("ptitle")}
              >
                Title
              </span>
              {
                (sortBy === "ptitle") ?
                  <span>
                    &nbsp;{(isAscending) ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />}
                  </span> : ""
              }
            </th>

            {/* last modified */}
            <th style={{ width: "20%" }}>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => this.handleSortProjects("mdate")}
              >
                Last Modified
              </span>
              {
                (sortBy === "mdate") ?
                  <span>
                    &nbsp;{(isAscending) ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />}
                  </span> : ""
              }
            </th>

            {/* date created */}
            <th style={{ width: "20%" }}>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => this.handleSortProjects("cdate")}
              >
                Date Created
              </span>
              {
                (sortBy === "cdate") ?
                  <span>
                    &nbsp;{(isAscending) ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />}
                  </span> : ""
              }
            </th>

            {/* actions */}
            <th style={{ width: "10%" }}>
              <span
                style={{ cursor: "default" }}
              >
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projectListDiv}
        </tbody>
      </Table>
    );
  }

  renderSettings() {
    return (
      <Modal show={this.state.showSettings} size="lg" onHide={() => { /* do nothing */ }}>

        {/* header */}
        <Modal.Header style={{ background: "whitesmoke" }}>
          <Modal.Title>Settings</Modal.Title>
        </Modal.Header>

        {/* body */}
        <Modal.Body>
          <Form className="container">

            {/* server */}
            {/* <Form.Group as={Row} onChange={(event) => this.setState({ tempServer: event.target.value })}>
              <Form.Label column sm="12" md="3" className="text-right">
                Server
              </Form.Label>
              <Col sm="12" md="9">
                <Form.Control type="url" defaultValue={window.server} />
              </Col>
            </Form.Group> */}

            {/* query server */}
            <Form.Group as={Row} style={{ marginTop: "1rem" }}>
              <Form.Label column sm="12" md="3" className="text-right">
                SPARQL&nbsp;endpoint
              </Form.Label>
              <Col sm="12" md="9">
                <Form.Control
                  as="select"
                  defaultValue={window.sparqlEndpoint}
                  ref="sparqlEndpoint"
                >
                  <option value="http://sitaware.isi.edu:8080/bigdata/namespace/wdq/sparql">http://sitaware.isi.edu:8080/bigdata/namespace/wdq/sparql</option>
                  <option value="http://kg2018a.isi.edu:8888/bigdata/namespace/wdq/sparql">http://kg2018a.isi.edu:8888/bigdata/namespace/wdq/sparql</option>
                  <option value="https://query.wikidata.org/sparql">https://query.wikidata.org/sparql</option>
                </Form.Control>
              </Col>
            </Form.Group>

            {/* cache (for clear qnode cache feature) */}
            {/* <Form.Group as={Row}>
              <Form.Label column sm="12" md="3" className="text-right">
                Cache
              </Form.Label>
              <Col sm="12" md="9">
                <Button variant="secondary" onClick={() => {
                  window.Wikifier.setState({ cacheQnode: {} });
                  alert("Emptied qnode cache.");
                  window.Wikifier.updateCacheQnode();
                }}>
                  Empty qnode cache
                </Button>
              </Col>
            </Form.Group> */}

          </Form>
        </Modal.Body>

        {/* footer */}
        <Modal.Footer style={{ background: "whitesmoke" }}>
          <Button variant="outline-dark" onClick={() => this.setState({ showSettings: false })}>
            Cancel
          </Button>
          <Button variant="dark" onClick={this.handleSaveSettings.bind(this)}>
            Save
          </Button>
        </Modal.Footer>

      </Modal>
    );
  }

  render() {
    return (
      <div>

        {/* loading spinner */}
        <div className="mySpinner" hidden={!this.state.showSpinner}>
          <Spinner animation="border" />
        </div>

        {this.renderCreateProject()}
        {this.renderDeleteProject()}
        {this.renderDownloadProject()}
        {this.renderRenameProject()}
        {this.renderSettings()}

        {/* navbar */}
        <div>
          <Navbar className="shadow" bg="dark" variant="dark" sticky="top" style={{ height: "50px" }}>

            {/* logo */}
            <T2WMLLogo />

            {/* avatar */}
            <Nav className="ml-auto">\
              <NavDropdown alignRight title={
                <Image src={this.state.userData.picture} rounded style={{ width: "30px", height: "30px" }} />
              }>
                <NavDropdown.Item disabled style={{ color: "gray" }}>
                  <div style={{ fontWeight: "bold" }}>
                    <FontAwesomeIcon icon={faUser} />
                    &nbsp;{this.state.userData.name}
                  </div>
                  <div>{this.state.userData.email}</div>
                </NavDropdown.Item>
                <NavDropdown.Divider />
                {/* <NavDropdown.Item
                  onClick={() => this.setState({ showSettings: true })}
                >
                  Settings
                </NavDropdown.Item>
                <NavDropdown.Divider /> */}
                <NavDropdown.Item
                  style={{ color: "hsl(0, 100%, 30%)" }}
                  onClick={() => this.handleLogout()}
                >
                  Log&nbsp;out
                </NavDropdown.Item>
              </NavDropdown>
            </Nav>

          </Navbar>
        </div>

        {/* content */}
        <div style={{ height: "calc(100vh - 50px)", background: "#f8f9fa", paddingTop: "20px" }}>
          <Card className="shadow-sm" style={{ width: "90%", maxWidth: "800px", height: "calc(100vh - 90px)", margin: "0 auto" }}>
            <Card.Header style={{ height: "40px", padding: "0.5rem 1rem", background: "#343a40" }}>
              <div
                className="text-white font-weight-bold d-inline-block text-truncate"
                style={{ width: "100%", cursor: "default" }}
              >
                Projects
              </div>
            </Card.Header>
            <Card.Body style={{ padding: "20px 5%", overflowY: "auto" }}>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "inline-block", width: "40%" }}>
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ fontWeight: "600" }}
                    onClick={() => {
                      this.setState({
                        tempCreateProject: "Untitled project",
                        isTempCreateProjectVaild: true,
                        showCreateProject: true
                      });
                    }}
                  >
                    New project
                  </Button>
                </div>
                <div style={{ display: "inline-block", width: "60%" }}>
                  <InputGroup size="sm">
                    <InputGroup.Prepend>
                      <InputGroup.Text style={{ background: "whitesmoke" }}>
                        <FontAwesomeIcon icon={faSearch} />
                      </InputGroup.Text>
                    </InputGroup.Prepend>
                    <FormControl placeholder="Search projects..." onChange={(event) => this.setState({ tempSearch: event.target.value })} />
                  </InputGroup>
                </div>
              </div>
              {this.renderProjects()}
            </Card.Body>
          </Card>
        </div>
      </div>
    );
  }
}

export default App;
