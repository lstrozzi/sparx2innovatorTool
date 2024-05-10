var xmlDoc = null;
var extracted = {};

//#region Sparx Importer
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
                    console.log(attributeValues); // This will log the attributes as an object
                }

                objects[dict['ea_guid']] = dict;
            });
            totalObjects = Object.assign(totalObjects, objects);
        }
    }

    let count = Object.keys(totalObjects).length;
    console.log(`Number of rows in ${tableName}: ${count}`);

    return totalObjects;
}

function importNativeFile() {
    extracted.packages       = importObjects('t_package');
    extracted.elements       = importObjects('t_object');
    extracted.connectors     = importObjects('t_connector');
    extracted.attributes     = importObjects('t_attribute');
    extracted.operations     = importObjects('t_operation');
    extracted.diagrams       = importObjects('t_diagram');
    extracted.diagramobjects = importObjects('t_diagramobjects');
    extracted.taggedvalues   = importObjects('t_taggedvalue');
    extracted.xrefs          = importObjects('t_xref');
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

function exportToInnovator() {
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
    // TODO exportDiagrams(doc, model);

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
        rel.setAttribute('identifier', connector['Connector_ID']);
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
                innovatortype = 'InformationFlow';
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

    // add all diagrams
    for (let key in extracted.diagrams) {
        let diagram = extracted.diagrams[key];
        //   <diagrams>
        //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
        let view = doc.createElement('view');
        diagrams.appendChild(view);
        view.setAttribute('identifier', diagram['Diagram_ID']);
        view.setAttribute('xsi:type', 'Diagram');
        view.setAttribute('viewpoint', 'ArchiMate Diagram');

        //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
        //        <name xml:lang="de">Prova1</name>
        let viewname = doc.createElement('name');
        viewname.setAttribute('xml:lang', 'de');
        viewname.textContent = diagram['Name'];
        view.appendChild(viewname);

        for (let diagramelement of Object.values(diagram['diagramelements'])) {
            let element = allElements[diagramelement.subject];
            let connector = allConnectors[diagramelement.subject];
            if (element != null) {
                if (element.type == 'Port') continue;
                //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
                //        <node identifier="EAID_94620B68_C54A_435d_899D_652653D6D95F" xsi:type="Container" x="0" y="40" w="220" h="50">
                //          <label xml:lang="de">Actor1</label>
                //        </node>
                let node = doc.createElement('node');
                view.appendChild(node);
                node.setAttribute('identifier', diagramelement.subject);
                node.setAttribute('xsi:type', convertElementType(element.type));
                let geometry = diagramelement.geometry.split(';');  // Left=351;Top=197;Right=366;Bottom=212;
                node.setAttribute('x', geometry[0].split('=')[1]);
                node.setAttribute('y', geometry[1].split('=')[1]);
                node.setAttribute('w', geometry[2].split('=')[1]);
                node.setAttribute('h', geometry[3].split('=')[1]);
                let label = doc.createElement('label');
                label.setAttribute('xml:lang', 'de');
                label.textContent = element.name;
                node.appendChild(label);
            } else if (connector != null) {
                //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
                //        <connection identifier="EAID_1CF9F3EF_2625_4d19_AC65_BBFE9D37CAAD" xsi:type="Line" source="EAID_94620B68_C54A_435d_899D_652653D6D95F" target="EAID_AB5B300A_4BB6_4def_96B1_BC69E66A68D0">
                //           <sourceAttachment x="220" y="65" />
                //           <targetAttachment x="320" y="65" />
                //        </connection>
                let connection = doc.createElement('connection');
                view.appendChild(connection);
                let sourceid = localidmap['E-'+connector['startid']]['id'];
                if (allElements[sourceid]['type'] == 'Port') {
                    sourceid = allElements[sourceid]['owner'];
                }
                let targetid = localidmap['E-'+connector['endid']]['id'];
                if (allElements[targetid]['type'] == 'Port') {
                    targetid = allElements[targetid]['owner'];
                }
                connection.setAttribute('identifier', diagramelement.subject);
                connection.setAttribute('xsi:type', 'Line');
                connection.setAttribute('source', sourceid);
                connection.setAttribute('target', targetid);
                let geometry = diagramelement['geometry'].split(';');        // SX=0;SY=0;EX=0;EY=0;EDGE=2;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;Path=;
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
                let sourceAttachment = doc.createElement('sourceAttachment');
                sourceAttachment.setAttribute('x', sx);
                sourceAttachment.setAttribute('y', sy);
                connection.appendChild(sourceAttachment);
                let targetAttachment = doc.createElement('targetAttachment');
                targetAttachment.setAttribute('x', ex);
                targetAttachment.setAttribute('y', ey);
                connection.appendChild(targetAttachment);
            }
        }
    }
}
//#endregion

//#region main
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
        
        var innovatorXmi = exportToInnovator();
        var blob = new Blob([innovatorXmi], {type: 'text/xml'});

        // Create a URL for the Blob
        var url = URL.createObjectURL(blob);

        // Set the href of the download link to the Blob URL and show the link
        var downloadLink = document.getElementById('downloadLink');
        downloadLink.href = url;
        downloadLink.download = 'processed_' + file.name;
        downloadLink.style.display = 'block';    };
    reader.readAsText(file);
}
//#endregion
