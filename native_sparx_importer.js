var xmlDoc = null;
var extracted = {};
let exportedDiagrams = [];

//#region Sparx Importer
function convert_guid(guid) {
    // strip the curly braces, convert to uppercase, then add the 'ea' prefix
    guid = guid.replace(/[{}]/g, '').toUpperCase();
    return "EA_" + guid;
}

function importObjects(tableName) {
    let tables = xmlDoc.getElementsByTagName('Table');
    let totalObjects = {};

    for (let i = 0; i < tables.length; i++) {
        if (tables[i].getAttribute('name') === tableName) {
            // analyse all rows in the table
            let rows = tables[i].getElementsByTagName('Row');
            let objects = [];
            Array.from(rows).forEach(row => {
                // analyse all columns in the row
                let columns = row.getElementsByTagName('Column');
                let dict = {};
                Array.from(columns).forEach(column => {
                    let name = column.getAttribute('name');
                    let value = column.getAttribute('value');
                    dict[name] = value;
                });

                // analyse the Extension row
                let extension = row.getElementsByTagName('Extension');
                if (extension.length > 0) {
                    // get all attributes in the Extension tag, if present. For example get Start_Object_ID and End_Object_ID from <Extension Start_Object_ID="{C1E7FC41-C7D7-411a-A4BB-058C1E85A3EC}" End_Object_ID="{D6C559A3-F112-4f97-9404-AE5082639A37}"/>
                    let attributes = extension[0].attributes;
                    let attributeValues = {};
                    for(let i = 0; i < attributes.length; i++) {
                        dict[attributes[i].name] = attributes[i].value;
                    }
                }

                // convert GUIDs to the format used in Innovator
                if (dict['Start_Object_ID'] != null) {
                    dict['Start_Object_ID'] = convert_guid(dict['Start_Object_ID']);
                }
                if (dict['End_Object_ID'] != null) {
                    dict['End_Object_ID'] = convert_guid(dict['End_Object_ID']);
                }
                if (dict['Diagram_ID'] != null) {
                    dict['Diagram_ID'] = convert_guid(dict['Diagram_ID']);
                }
                if (dict['DiagramID'] != null) {
                    dict['Diagram_ID'] = convert_guid(dict['DiagramID']);
                }

                // store the object in the dictionary
                if (dict['ea_guid'] != null) {
                    dict['ea_guid'] = convert_guid(dict['ea_guid']);
                    objects[dict['ea_guid']] = dict;
                } else if (dict['Object_ID'] != null) {
                    dict['Object_ID'] = convert_guid(dict['Object_ID']);
                    objects[dict['Object_ID']] = dict;
                } else if (dict['Client'] != null) {
                    dict['Client'] = convert_guid(dict['Client']);
                    objects[dict['Client']] = dict;
                } else if (dict['ConnectorID'] != null) {
                    dict['Connector_ID'] = convert_guid(dict['ConnectorID']);
                    objects[dict['Connector_ID']] = dict;
                } else {
                    console.log('No GUID or Object_ID found for object');
                }
            });
            totalObjects = Object.assign(totalObjects, objects);
        }
    }

    let count = Object.keys(totalObjects).length;
    console.log(`Number of rows in ${tableName}: ${count}`);

    return totalObjects;
}

function importNativeFile() {
    exportedDiagrams = [];

    extracted.packages       = importObjects('t_package');
    extracted.elements       = importObjects('t_object');
    extracted.connectors     = importObjects('t_connector');
    extracted.attributes     = importObjects('t_attribute');
    extracted.operations     = importObjects('t_operation');
    extracted.diagrams       = importObjects('t_diagram');
    extracted.diagramobjects = importObjects('t_diagramobjects');
    extracted.diagramlinks   = importObjects('t_diagramlinks');
    extracted.taggedvalues   = importObjects('t_taggedvalue');
    extracted.xrefs          = importObjects('t_xref');
}
//#endregion

//#region Diagrams table
function fillDiagramsTable() {
    let table = document.getElementById('diagramsTable');
    let tbody = table.getElementsByTagName('tbody')[0];

    for (let key in extracted.diagrams) {
        // use the existing row with id="diagramrow-template" as a template
        let diagram = extracted.diagrams[key];
        let row = document.getElementById('diagramrow-template').cloneNode(true);
        row.removeAttribute('id');
        row.style.display = 'table-row';
        row.style.hidden = false;

        // fill the row with the diagram data:
        // the first column contains an input checkbox, it should be enabled as it is in the template
        // the second column contains the diagram name
        let cells = row.getElementsByTagName('td');
        cells[1].textContent = diagram['Name'];
        cells[2].textContent = diagram['ea_guid'];

        tbody.appendChild(row);
    }
}
//#endregion

//#region Innovator Exporter
function formatXml(xml) {
    var reg = /(>)(<)(\/*)/g;
    var wsexp = / *(.*) +\n/g;
    var contexp = /(<.+>)(.+\n)/g;
    xml = xml.replace(reg, '$1\n$2$3').replace(wsexp, '$1\n').replace(contexp, '$1$2');
    var pad = 0;
    var formatted = '';
    var lines = xml.split('\n');
    var indent = 0;
    var lastType = 'other';
    // 4 types of tags - single, closing, opening, other (text, doctype, comment) - 4*4 = 16 transitions 
    var transitions = {
        'single->single'    : 0,
        'single->closing'   : -1,
        'single->opening'   : 0,
        'single->other'     : 0,
        'closing->single'   : 0,
        'closing->closing'  : -1,
        'closing->opening'  : 0,
        'closing->other'    : 0,
        'opening->single'   : 1,
        'opening->closing'  : 0, 
        'opening->opening'  : 1,
        'opening->other'    : 1,
        'other->single'     : 0,
        'other->closing'    : -1,
        'other->opening'    : 0,
        'other->other'      : 0
    };

    for (var i=0; i < lines.length; i++) {
        var ln = lines[i];
        var single = Boolean(ln.match(/<.+\/>/)); // is this line a single tag? ex. <br />
        var closing = Boolean(ln.match(/<\/.+>/)); // is this a closing tag? ex. </a>
        var opening = Boolean(ln.match(/<[^!].*>/)); // is this even a tag (that's not <!something>)
        var type = single ? 'single' : closing ? 'closing' : opening ? 'opening' : 'other';
        var fromTo = lastType + '->' + type;
        lastType = type;
        var padding = '';

        indent += transitions[fromTo];
        for (var j = 0; j < indent; j++) {
            padding += '  ';
        }

        formatted += padding + ln + '\n';
    }

    return formatted;
};

function identifyExportedObjects() {
    // identify which diagrams, elements and connector to export
    let diagrams = document.getElementById('diagramsTable').getElementsByTagName('input');
    let exportedDiagrams = []; // make sure to declare this array
    for (let i = 0; i < diagrams.length; i++) {
        if (diagrams[i].checked) {
            if (diagrams[i].parentElement.nextElementSibling.textContent == 'Diagram Name') continue;
            if (diagrams[i].parentElement.nextElementSibling.textContent == 'Select/unselect all diagrams') continue;
            let ea_guid = diagrams[i].parentElement.nextElementSibling.nextElementSibling.textContent;
            if (ea_guid == 'Enterprise Architect Global Unique Identifier') continue;
            exportedDiagrams.push(ea_guid);
        }
    }
}

function exportToInnovator() {
    // identify which diagrams, elements and connector to export
    identifyExportedObjects();

    // prepare basic export XMI structure
    let doc = new DOMParser().parseFromString('<model></model>', 'application/xml');
    let model = doc.firstChild;

    // <?xml version="1.0" encoding="utf-8" standalone="no"?>
    // <model xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengroup.org/xsd/archimate/3.0/ http://www.opengroup.org/xsd/archimate/3.1/archimate3_Diagram.xsd http://purl.org/dc/elements/1.1/ http://www.opengroup.org/xsd/archimate/3.1/dc.xsd" version="16.0.1.21019" identifier="id-085c6229-1eec-4881-889f-99b109ade5b8" xmlns="http://www.opengroup.org/xsd/archimate/3.0/">
    model.setAttribute('xmlns:dc', 'http://purl.org/dc/elements/1.1/');
    model.setAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
    model.setAttribute('xsi:schemaLocation', 'http://www.opengroup.org/xsd/archimate/3.0/ http://www.opengroup.org/xsd/archimate/3.1/archimate3_Diagram.xsd http://purl.org/dc/elements/1.1/ http://www.opengroup.org/xsd/archimate/3.1/dc.xsd');
    model.setAttribute('version', '16.0.1.21019');
    model.setAttribute('identifier', 'id-085c6229-1eec-4881-889f-99b109ade5b8');
    model.setAttribute('xmlns', 'http://www.opengroup.org/xsd/archimate/3.0/');

    // <name xml:lang="de">Innovator</name>
    let name = doc.createElement('name');
    name.setAttribute('xml:lang', 'de');
    name.textContent = 'Innovator';
    model.appendChild(name);

    // Export elements
    exportElements(doc, model);

    // Export connectors
    exportConnectors(doc, model);

    // Export diagrams
    exportDiagrams(doc, model);

    // export all elements into a single diagram without connectors
    exportAllElements(doc, model);

    // Serialize XML DOM to string
    let serializer = new XMLSerializer();
    let xmlStr = serializer.serializeToString(doc);
    let xmlPretty = formatXml(xmlStr, "  ");

    return xmlPretty;
}

const elementTypeBlackList = ['Port', 'DataType', 'Package'];
function exportElements(doc, model) {
    // <elements>
    let elements = doc.createElement('elements');
    model.appendChild(elements);

    // add all elements
    for (let key in extracted.elements) {
        let element = extracted.elements[key];
        if (elementTypeBlackList.includes(element['Object_Type'])) continue;

        // <element identifier="EAID_94620B68_C54A_435d_899D_652653D6D95F" xsi:type="Actor">
        let el = doc.createElement('element');
        elements.appendChild(el);
        el.setAttribute('identifier', element['ea_guid']);
        el.setAttribute('xsi:type', convertElementType(element['Object_Type']));

        // <name xml:lang="de">Actor1</name>
        let elName = doc.createElement('name');
        elName.setAttribute('xml:lang', 'de');
        elName.textContent = element['Name'];
        el.appendChild(elName);
    }
}

function convertElementType(sparxtype) {
    switch (sparxtype) {
        case 'Component':
            innovatortype = 'ApplicationComponent';
            break;
        case 'Class':
            innovatortype = 'BusinessObject';
            break;
        case 'Actor':
            innovatortype = 'BusinessRole';
            break;
        default:
            innovatortype = sparxtype;
            break;
    }
    return innovatortype;
}

function exportConnectors(doc, model) {
    // <relationships>
    let relationships = doc.createElement('relationships');
    model.appendChild(relationships);

    // add all connectors
    for (let key in extracted.connectors) {
        let connector = extracted.connectors[key];
        // <relationship identifier="EAID_1CF9F3EF_2625_4d19_AC65_BBFE9D37CAAD" xsi:type="Association" source="EAID_94620B68_C54A_435d_899D_652653D6D95F" target="EAID_AB5B300A_4BB6_4def_96B1_BC69E66A68D0">
        let rel = doc.createElement('relationship');
        relationships.appendChild(rel);
        rel.setAttribute('identifier', connector['ea_guid']);
        rel.setAttribute('xsi:type', convertConnectorType(connector['Connector_Type']));

        // source and target identifiers
        let sourceid = connector['Start_Object_ID'];
        let targetid = connector['End_Object_ID'];
        rel.setAttribute('source', sourceid);
        rel.setAttribute('target', targetid);
    }
}

function convertConnectorType(sparxtype) {
    switch (sparxtype) {
        case 'Association':
            innovatortype = 'Association';
            break;
        case 'InformationFlow':
            innovatortype = 'Flow';
            break;
        case 'Usage':
            innovatortype = 'Access';
            break;
        default:
            innovatortype = sparxtype;
            break;
    }
    return innovatortype;
}

function exportDiagrams(doc, model) {
    // <views>
    let views = doc.createElement('views');
    model.appendChild(views);

    // <views>
    //   <diagrams>
    let diagrams = doc.createElement('diagrams');
    views.appendChild(diagrams);

    // add diagrams and their elements
    for (let key in extracted.diagrams) {
        let diagram = extracted.diagrams[key];
        //   <diagrams>
        //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
        let view = doc.createElement('view');
        diagrams.appendChild(view);
        view.setAttribute('identifier', diagram['ea_guid']);
        view.setAttribute('xsi:type', 'Diagram');
        view.setAttribute('viewpoint', 'ArchiMate Diagram');

        //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
        //        <name xml:lang="de">Prova1</name>
        let viewname = doc.createElement('name');
        viewname.setAttribute('xml:lang', 'de');
        viewname.textContent = diagram['Name'];
        view.appendChild(viewname);

        let nodes = [];
        for (let key in extracted.diagramobjects) {
            let diagramelement = extracted.diagramobjects[key];
            if (diagramelement['Diagram_ID'] != diagram['ea_guid']) continue;
            let element = extracted.elements[diagramelement['Object_ID']];
            if (element != null) {
                if (element['Object_Type'] == 'Port') continue;
                //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
                //        <node identifier="EAID_94620B68_C54A_435d_899D_652653D6D95F" xsi:type="Container" x="0" y="40" w="220" h="50">
                //          <label xml:lang="de">Actor1</label>
                //        </node>
                let node = doc.createElement('node');
                view.appendChild(node);
                node.setAttribute('identifier', "_" + diagramelement['Instance_ID']);
                node.setAttribute('elementRef', diagramelement['Object_ID']);
                node.setAttribute('xsi:type', "Element");
                node.setAttribute('x', diagramelement['RectLeft']);
                node.setAttribute('y', -diagramelement['RectTop']);
                node.setAttribute('w', parseInt(diagramelement['RectRight'])-parseInt(diagramelement['RectLeft']));
                node.setAttribute('h', -parseInt(diagramelement['RectBottom'])+parseInt(diagramelement['RectTop']));
                let label = doc.createElement('label');
                label.setAttribute('xml:lang', 'de');
                label.textContent = element['Name'];
                node.appendChild(label);

                nodes[element['ea_guid']] = "_" + diagramelement['Instance_ID'];
            }
        }

        // diagram links (the connectors that appear in the diagram)
        for (let key in extracted.diagramlinks) {
            let diagramlink = extracted.diagramlinks[key];
            if (diagramlink['Diagram_ID'] != diagram['ea_guid']) continue;
            if (diagramlink != null) {
                //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
                //        <connection identifier="EAID_1CF9F3EF_2625_4d19_AC65_BBFE9D37CAAD" xsi:type="Line" source="EAID_94620B68_C54A_435d_899D_652653D6D95F" target="EAID_AB5B300A_4BB6_4def_96B1_BC69E66A68D0">
                //           <sourceAttachment x="220" y="65" />
                //           <targetAttachment x="320" y="65" />
                //        </connection>
                let connector = extracted.connectors[diagramlink['Connector_ID']];
                if (connector == null) continue;
                let connection = doc.createElement('connection');
                view.appendChild(connection);
                let sourceid = connector['Start_Object_ID'];
                let source = extracted.elements[sourceid];
                if (source['Object_Type'] == 'Port') {
                    // TODO
                    sourceid = allElements[sourceid]['owner'];
                }
                let targetid = connector['End_Object_ID'];
                let target = extracted.elements[targetid];
                if (target['Object_Type'] == 'Port') {
                    // TODO
                    targetid = allElements[targetid]['owner'];
                }
                connection.setAttribute('identifier', "DL-" + diagramlink['Instance_ID']);
                connection.setAttribute('xsi:type', 'Line');
                connection.setAttribute('source', nodes[sourceid]);
                connection.setAttribute('target', nodes[targetid]);

                // connector geometry
                let geometry = diagramlink['Geometry'].split(';');        // SX=0;SY=0;EX=0;EY=0;EDGE=2;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;Path=;
                let sx = undefined;
                let sy = undefined;
                let ex = undefined;
                let ey = undefined;
                for (let geometryItem of geometry) {
                    if (geometryItem.startsWith('SX=')) {
                        sx = geometryItem.split('=')[1];
                    }
                    if (geometryItem.startsWith('SY=')) {
                        sy = geometryItem.split('=')[1];
                    }
                    if (geometryItem.startsWith('EX=')) {
                        ex = geometryItem.split('=')[1];
                    }
                    if (geometryItem.startsWith('EY=')) {
                        ey = geometryItem.split('=')[1];
                    }
                }
                if (sx != undefined && sy != undefined) {
                    sx = Math.max(sx, 0);
                    sy = Math.max(sy, 0);
                    let sourceAttachment = doc.createElement('sourceAttachment');
                    sourceAttachment.setAttribute('x', sx);
                    sourceAttachment.setAttribute('y', sy);
                    connection.appendChild(sourceAttachment);
                }
                if (ex != undefined && ey != undefined) {
                    ex = Math.max(ex, 0);
                    ey = Math.max(ey, 0);
                    let targetAttachment = doc.createElement('targetAttachment');
                    targetAttachment.setAttribute('x', ex);
                    targetAttachment.setAttribute('y', ey);
                    connection.appendChild(targetAttachment);
                }
            }
        }
    }
}

function exportAllElements(doc, model) {
    const N = 20; // number of horizontal nodes

    // <views>
    //   <diagrams>
    let diagrams = doc.getElementsByTagName('diagrams')[0];
 
    //   <diagrams>
    //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
    let view = doc.createElement('view');
    diagrams.appendChild(view);
    view.setAttribute('identifier', 'AllElements');
    view.setAttribute('xsi:type', 'Diagram');
    view.setAttribute('viewpoint', 'ArchiMate Diagram');

    //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
    //        <name xml:lang="de">All Elements</name>
    let viewname = doc.createElement('name');
    viewname.setAttribute('xml:lang', 'de');
    viewname.textContent = 'All Elements';
    view.appendChild(viewname);

    let nodes = [];
    instanceid = 0;
    for (let key in extracted.elements) {
        let element = extracted.elements[key];
        if (elementTypeBlackList.includes(element['Object_Type'])) continue;
        //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
        //        <node identifier="EAID_94620B68_C54A_435d_899D_652653D6D95F" xsi:type="Container" x="0" y="40" w="220" h="50">
        //          <label xml:lang="de">Actor1</label>
        //        </node>
        let node = doc.createElement('node');
        view.appendChild(node);
        node.setAttribute('identifier', "_" + ++instanceid);
        node.setAttribute('elementRef', element['ea_guid']);
        node.setAttribute('xsi:type', "Element");

        // position the node in the diagram, each node is positioned in a matrix with N horizontal nodes, with 50px separation between nodes horizontally and vertically
        let i = Object.keys(nodes).length;
        let x = 50 + (i % N) * 250;
        let y = 50 + Math.floor(i / N) * 100;
        node.setAttribute('x', x);
        node.setAttribute('y', y);
        node.setAttribute('w', 220);
        node.setAttribute('h', 50);
        let label = doc.createElement('label');
        label.setAttribute('xml:lang', 'de');
        label.textContent = element['Name'];
        node.appendChild(label);

        nodes[element['ea_guid']] = element['ea_guid'];
    }
}
//#endregion

//#region main
function convert_filename(filename) {
    if (filename.includes("Sparx.xml")) {
        return filename.replace('Sparx.xml', 'Innovator.xml');
    } else {
        return filename.replace('.xml', '-Innovator.xml');
    }
}

function processNativeFile(file) {
    var reader = new FileReader();

    reader.onload = function(e) {
        console.log('Reading file...');
        var contents = e.target.result;
        // Process contents here
        // The file contains XML. Import the XML to a DOM and then process it
        var parser = new DOMParser();
        xmlDoc = parser.parseFromString(contents, 'text/xml');
        console.log('...file read');

        importNativeFile();
        exportToInnovator();

        fillDiagramsTable();
    };
    reader.readAsText(file);
}

function convertNativeFile(file) {
    var reader = new FileReader();

    reader.onload = function(e) {
        var innovatorXmi = exportToInnovator();
        var blob = new Blob([innovatorXmi], {type: 'text/xml'});

        // Create a URL for the Blob
        var url = URL.createObjectURL(blob);

        // Set the href of the download link to the Blob URL and show the link
        var downloadLink = document.getElementById('downloadLink');
        downloadLink.href = url;
        downloadLink.download = convert_filename(file.name);
        downloadLink.style.display = 'block';
    };
    reader.readAsText(file);
}
//#endregion
