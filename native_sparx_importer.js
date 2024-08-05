var xmlDoc = null;
var extracted = {};
var objectIdsToBeExported = [];

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
                        extensionName = attributes[i].name;
                        extensionValue = attributes[i].value;
                        if (extensionName == 'Object_ID') {
                            // convert Object_ID to Element_ID to avoid confusion with the Object_ID of the current object
                            extensionName = 'Element_ID';
                        } else if (extensionName == 'Diagram_ID') {
                            // convert Object_ID to Object_in_Diagram_ID to avoid confusion with the Diagram_ID of the current object
                            extensionName = 'Object_in_Diagram_ID';
                        }
                        if (extensionValue.startsWith('{')) {
                            extensionValue = convert_guid(extensionValue);
                        }
                        dict[extensionName] = extensionValue;
                    }
                }

                // convert GUIDs to the format used in Innovator
                if (dict['Start_Object_ID'] != null) {
                    if (dict['Start_Object_ID'].startsWith('{')) {
                        dict['Start_Object_ID'] = convert_guid(dict['Start_Object_ID']);
                    }
                }
                if (dict['End_Object_ID'] != null) {
                    if (dict['End_Object_ID'].startsWith('{')) {
                        dict['End_Object_ID'] = convert_guid(dict['End_Object_ID']);
                    }
                }
                if (dict['Diagram_ID'] != null) {
                    diagId = dict['Diagram_ID'];
                    if (diagId.startsWith('{')) {
                        diagId = convert_guid(diagId);
                    }
                    dict['Diagram_ID'] = diagId;
                }
                if (dict['DiagramID'] != null) {
                    diagId = dict['DiagramID'];
                    if (diagId.startsWith('{')) {
                        diagId = convert_guid(diagId);
                    }
                    dict['Diagram_ID'] = diagId;
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
                    if (dict['ConnectorID'].startsWith('{')) {
                        dict['Connector_ID'] = convert_guid(dict['ConnectorID']);
                    } else {
                        dict['Connector_ID'] = dict['ConnectorID'];
                    }
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
    objectIdsToBeExported = [];

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
    let decoder = new TextDecoder('utf-8');

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

// fills the objectIdsToBeExported object with the GUIDs of the diagrams, elements and connectors to be exported
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

    // use the exported diagrams to identify the elements, diagrams and connectors to export
    objectIdsToBeExported = {
        'elements': [],
        'connectors': [],
        'diagrams': []
    };
    for (let diagramkey in extracted.diagrams) {
        // include all selected diagram IDs
        if (exportedDiagrams.includes(extracted.diagrams[diagramkey]['ea_guid'])) {
            objectIdsToBeExported.diagrams.push(extracted.diagrams[diagramkey]['ea_guid']);
        }

        // include all selected elements that appear on the diagram. To find out which
        // elements appear on the diagram, we need to look at the diagramobjects table
        for (let dokey in extracted.diagramobjects) {
            let diagramobject = extracted.diagramobjects[dokey];
            let diagramobject_diagram_id = diagramobject['Object_in_Diagram_ID'];
            if (objectIdsToBeExported.diagrams.includes(diagramobject_diagram_id)) {
                let element = extracted.elements[diagramobject['Element_ID']];  // this is coming from the Extension part of the diagramobjects table, there it's called Object_ID but it's renamed to Element_ID to avoid overriding the Object_ID of the t_diagramobjects table
                if (!objectIdsToBeExported.elements.includes(diagramobject['Element_ID'])) {
                    objectIdsToBeExported.elements.push(diagramobject['Element_ID']);
                }
            }
        }

        // include all selected connectors that appear on the diagram. To find out which
        // connectors appear on the diagram, we need to look at the diagramlinks table
        for (let dlkey in extracted.diagramlinks) {
            let diagramlink = extracted.diagramlinks[dlkey];
            let diagramlink_diagram_id = diagramlink['Diagram_ID'];
            if (objectIdsToBeExported.diagrams.includes(diagramlink_diagram_id)) {
                if (!objectIdsToBeExported.connectors.includes(diagramlink['Connector_ID'])) {
                    objectIdsToBeExported.connectors.push(diagramlink['Connector_ID']);
                }
            }
        }
    }
}

function exportToInnovator(filter) {
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
    exportElements(doc, model, filter);

    // Export connectors
    exportConnectors(doc, model, filter);

    // Export properties
    exportProperties(doc, model, filter);

    // Export diagrams
    exportDiagrams(doc, model, filter);

    // export all elements into a single diagram without connectors
    exportAllElements(doc, model, filter);

    // Serialize XML DOM to string
    let serializer = new XMLSerializer();
    let xmlStr = serializer.serializeToString(doc);
    let xmlPretty = formatXml(xmlStr, "  ");

    return xmlPretty;
}

// TODO: enable again if needed: 
const elementTypeBlackList = ['DataType', 'Package'];

function exportElements(doc, model, filter) {
    // <elements>
    let elements = doc.createElement('elements');
    model.appendChild(elements);

    // add all elements
    for (let key in extracted.elements) {
        if (filter && !objectIdsToBeExported.elements.includes(key)) continue;

        let element = extracted.elements[key];
        if (elementTypeBlackList.includes(element['Object_Type'])) continue;
        if (element['Object_Type'] == 'Port') continue;

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

        //       <properties>
        //         <property propertyDefinitionRef="id-Stereotype">
        //           <value xml:lang="de">ApplicationBusinessApplication</value>
        //         </property>
        //       </properties>
        let mmb_stereotype = convertStereotype(element['Stereotype']);
        let properties = doc.createElement('properties');
        el.appendChild(properties);
        let property = doc.createElement('property');
        properties.appendChild(property);
        property.setAttribute('propertyDefinitionRef', 'id-Stereotype');
        let value = doc.createElement('value');
        value.setAttribute('xml:lang', 'de');
        value.textContent = mmb_stereotype;
        property.appendChild(value);
    }
}

function convertElementType(sparxtype) {
    switch (sparxtype) {
        case 'Component':
            innovatortype = 'ApplicationCollaboration';
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

function convertStereotype(sparxstereotype) {
    switch (sparxstereotype) {
        case 'ReplacedBy':
            innovatorstereotype = 'AssociationApplicationDirected_ToApplicationReplacedByApplication';
            break;
        case 'bag_InfSys':
            innovatorstereotype = 'ApplicationBusinessApplication';
            break;
        default:
            innovatorstereotype = sparxstereotype;
            break;
    }
    return innovatorstereotype;
}

function exportProperties(doc, model, filter) {
    // add all properties
    // <propertyDefinitions>
    //   <propertyDefinition identifier="id-Stereotype" type="string">
    //     <name>Stereotype</name>
    //     <name xml:lang="en">Stereotype</name>
    //     <name xml:lang="de">Stereotyp</name>
    //   </propertyDefinition>
    // </propertyDefinitions>
    let propertyDefinitions = doc.createElement('propertyDefinitions');
    model.appendChild(propertyDefinitions);
    let propertyDefinition = doc.createElement('propertyDefinition');
    propertyDefinitions.appendChild(propertyDefinition);
    propertyDefinition.setAttribute('identifier', 'id-Stereotype');
    propertyDefinition.setAttribute('type', 'string');
    let name = doc.createElement('name');
    name.textContent = 'Stereotype';
    propertyDefinition.appendChild(name);
    let name_en = doc.createElement('name');
    name_en.setAttribute('xml:lang', 'en');
    name_en.textContent = 'Stereotype';
    propertyDefinition.appendChild(name_en);
    let name_de = doc.createElement('name');
    name_de.setAttribute('xml:lang', 'de');
    name_de.textContent = 'Stereotyp';
    propertyDefinition.appendChild(name_de);
}

function exportConnectors(doc, model, filter) {
    if (extracted.connectors == null || extracted.connectors.length == 0) return;

    // <relationships>
    let relationships = doc.createElement('relationships');
    model.appendChild(relationships);

    // add all connectors
    for (let key in extracted.connectors) {
        if (filter && !objectIdsToBeExported.connectors.includes(key)) continue;

        let connector = extracted.connectors[key];
        let sourceid = connector['Start_Object_ID'];
        let targetid = connector['End_Object_ID'];
        let mmb_stereotype = convertStereotype(connector['Stereotype']);

        // <relationship identifier="EAID_1CF9F3EF_2625_4d19_AC65_BBFE9D37CAAD" xsi:type="Association" source="EAID_94620B68_C54A_435d_899D_652653D6D95F" target="EAID_AB5B300A_4BB6_4def_96B1_BC69E66A68D0">
        let rel = doc.createElement('relationship');
        relationships.appendChild(rel);
        rel.setAttribute('identifier', connector['ea_guid']);
        rel.setAttribute('xsi:type', convertConnectorType(connector['Connector_Type']));

        // handle the case where the source or target is a port
        let sourceelement = extracted.elements[connector['Start_Object_ID']];
        if (sourceelement != null && 'Object_Type' in sourceelement && sourceelement['Object_Type'] == 'Port') {
            sourceelement = extracted.elements[sourceelement['ParentID']];
            sourceid = sourceelement['ea_guid'];
        }
        let targetelement = extracted.elements[connector['End_Object_ID']];
        if (targetelement != null && 'Object_Type' in targetelement && targetelement['Object_Type'] == 'Port') {
            targetelement = extracted.elements[targetelement['ParentID']];
            targetid = targetelement['ea_guid'];
        }

        // source and target identifiers
        rel.setAttribute('source', sourceid);
        rel.setAttribute('target', targetid);
        
        //       <name xml:lang="de">ApplicationBusinessApplication</name>
        let name = doc.createElement('name');
        name.setAttribute('xml:lang', 'de');
        name.textContent = connector['Name'];
        rel.appendChild(name);

        //       <properties>
        //         <property propertyDefinitionRef="id-Stereotype">
        //           <value xml:lang="de">ApplicationBusinessApplication</value>
        //         </property>
        //       </properties>
        let properties = doc.createElement('properties');
        rel.appendChild(properties);
        let property = doc.createElement('property');
        properties.appendChild(property);
        property.setAttribute('propertyDefinitionRef', 'id-Stereotype');
        let value = doc.createElement('value');
        value.setAttribute('xml:lang', 'de');
        value.textContent = mmb_stereotype;
        property.appendChild(value);
    }
}

function convertConnectorType(sparxtype) {
    switch (sparxtype) {
        case 'Dependency':
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

function exportDiagrams(doc, model, filter) {
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
        if (filter && !objectIdsToBeExported.diagrams.includes(diagram['ea_guid'])) continue;

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

        //       <properties>
        //         <property propertyDefinitionRef="id-Stereotype">
        //           <value xml:lang="de">DiagramEAEnterpriseArchitecture</value>
        //         </property>
        //       </properties>
        let mmb_stereotype = "DiagramEAEnterpriseArchitecture";
        let properties = doc.createElement('properties');
        view.appendChild(properties);
        let property = doc.createElement('property');
        properties.appendChild(property);
        property.setAttribute('propertyDefinitionRef', 'id-Stereotype');
        let value = doc.createElement('value');
        value.setAttribute('xml:lang', 'de');
        value.textContent = mmb_stereotype;
        property.appendChild(value);

        let nodes = {};
        for (let key in extracted.diagramobjects) {
            let diagramelement = extracted.diagramobjects[key];
            if (diagramelement['Diagram_ID'] != diagram['Diagram_ID']) continue;
            let element = extracted.elements[diagramelement['Element_ID']];
            if (element != null) {
                if (element['Object_Type'] == 'Port') continue;
                //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
                //        <node identifier="EAID_94620B68_C54A_435d_899D_652653D6D95F" xsi:type="Container" x="0" y="40" w="220" h="50">
                //          <label xml:lang="de">Actor1</label>
                //        </node>
                let node = doc.createElement('node');
                view.appendChild(node);
                node.setAttribute('identifier', "id-" + diagramelement['Instance_ID']);
                node.setAttribute('elementRef', diagramelement['Element_ID']);
                node.setAttribute('xsi:type', "Element");
                node.setAttribute('x', diagramelement['RectLeft']);
                node.setAttribute('y', -diagramelement['RectTop']);
                node.setAttribute('w', parseInt(diagramelement['RectRight'])-parseInt(diagramelement['RectLeft']));
                node.setAttribute('h', -parseInt(diagramelement['RectBottom'])+parseInt(diagramelement['RectTop']));
                let label = doc.createElement('label');
                label.setAttribute('xml:lang', 'de');
                label.textContent = element['Name'];
                node.appendChild(label);

                nodes[element['ea_guid']] = "id-" + diagramelement['Instance_ID'];
            }
        }

        // diagram links (the connectors that appear in the diagram)
        for (let key in extracted.diagramlinks) {
            let diagramlink = extracted.diagramlinks[key];
            if (diagramlink['Diagram_ID'] != diagram['ea_guid']) continue;
            if (diagramlink != null) {
                //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
                //        <connection identifier="id-2fc9c902-8a05-9be6-d8e7-ce6a02a401f7" relationshipRef="id-fb2e3752-de21-f0ca-b8b6-bfcc1c76f131" xsi:type="Relationship" source="id-57c7c9fc-2722-58a0-6327-9810885b4d26" target="id-ebcfaa3c-2443-b965-4c38-082cbc24290f">
                //          <sourceAttachment x="150" y="45" />
                //          <targetAttachment x="410" y="45" />
                //        </connection>
                let connector = extracted.connectors[diagramlink['Connector_ID']];
                if (connector == null) continue;
                let connection = doc.createElement('connection');
                view.appendChild(connection);
                let sourceid = connector['Start_Object_ID'];
                let source = extracted.elements[sourceid];
                if (source != null && 'Object_Type' in source && source['Object_Type'] == 'Port') {
                    sourceelement = extracted.elements[sourceid];
                    sourceid = sourceelement['ParentID'];
                }
                let targetid = connector['End_Object_ID'];
                let target = extracted.elements[targetid];
                if (target != null && 'Object_Type' in target && target['Object_Type'] == 'Port') {
                    targetelement = extracted.elements[targetid];
                    targetid = targetelement['ParentID'];
                    targetelement = extracted.elements[targetid];
                }
                connection.setAttribute('relationshipRef', diagramlink['Connector_ID']);
                connection.setAttribute('identifier', "DL-" + diagramlink['Instance_ID']);
                connection.setAttribute('xsi:type', 'Relationship');
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

    //         <properties>
    //           <property propertyDefinitionRef="id-Stereotype">
    //             <value xml:lang="de">DiagramEAEnterpriseArchitecture</value>
    //           </property>
    //         </properties>
    let mmb_stereotype = "DiagramEAEnterpriseArchitecture";
    let properties = doc.createElement('properties');
    view.appendChild(properties);
    let property = doc.createElement('property');
    properties.appendChild(property);
    property.setAttribute('propertyDefinitionRef', 'id-Stereotype');
    let value = doc.createElement('value');
    value.setAttribute('xml:lang', 'de');
    value.textContent = mmb_stereotype;
    property.appendChild(value);
    
    let nodes = [];
    instanceid = 0;
    for (let key in objectIdsToBeExported.elements) {
        let elementKey = objectIdsToBeExported.elements[key];
        let element = extracted.elements[elementKey];
        if (elementTypeBlackList.includes(element['Object_Type'])) continue;
        if (element['Object_Type'] == 'Port') continue;
        //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
        //        <node identifier="EAID_94620B68_C54A_435d_899D_652653D6D95F" xsi:type="Container" x="0" y="40" w="220" h="50">
        //          <label xml:lang="de">Actor1</label>
        //        </node>
        let node = doc.createElement('node');
        view.appendChild(node);
        node.setAttribute('identifier', "id-" + ++instanceid);
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
        exportToInnovator(false);

        fillDiagramsTable();
    };
    reader.readAsText(file, 'windows-1252');
}

function convertNativeFile(file) {
    var reader = new FileReader();

    reader.onload = function(e) {
        var innovatorXmi = exportToInnovator(true);
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
