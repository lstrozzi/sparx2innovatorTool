let allPackages = {}
let allElements = {}
let allConnectors = {}
let allDiagrams = {}
let localidmap = {}

//#region Sparx EA Extractor
function extractTaggedValue(xmlElement, tag) {
    // extract information from the tagged values
    let tv = null
    var taggedValueRoot = xmlElement.getElementsByTagName('UML:ModelElement.taggedValue')
    var taggedValues = taggedValueRoot[0].getElementsByTagName('UML:TaggedValue')
    for (var j = 0; j < taggedValues.length; j++) {
        var taggedValue = taggedValues[j];
        if (taggedValue.getAttribute('tag') == tag) {
            tv = taggedValue.getAttribute('value');
            break
        }
    }
    return tv
}

function extractPackages(xmlDoc, tag, tvmap) {
    var xmlpackages = xmlDoc.getElementsByTagName(tag)
    var packages = {}

    for (var i = 0; i < xmlpackages.length; i++) {
        var xmlelement = xmlpackages[i];
        if (xmlelement.getAttribute('isRoot') == 'false') {
            // extract basic information
            let item = {}
            item['name'] = xmlelement.getAttribute('name')
            item['id'] = xmlelement.getAttribute('xmi.id')

            // tvmap is a dictionary of tagged values to extract. Key=tag, value:name of the key to be added to the item
            for (var tag in tvmap) {
                item[tvmap[tag]] = extractTaggedValue(xmlelement, tag);
            }

            // add the information to the classes dictionary
            let id = item['id']
            packages[id] = item
        }
    }

    return packages
}

function extractElements(xmlDoc, tag, tvmap) {
    var xmlelements = xmlDoc.getElementsByTagName(tag)
    var elements = {}

    for (var i = 0; i < xmlelements.length; i++) {
        var xmlelement = xmlelements[i];
        if (xmlelement.getAttribute('isRoot') == 'false') {
            // extract basic information
            let item = {}
            item['name'] = xmlelement.getAttribute('name')
            item['id'] = xmlelement.getAttribute('xmi.id')

            // tvmap is a dictionary of tagged values to extract. Key=tag, value:name of the key to be added to the item
            for (var tag in tvmap) {
                item[tvmap[tag]] = extractTaggedValue(xmlelement, tag);
            }

            // add the information to the classes dictionary
            let id = item['id']
            elements[id] = item
            localidmap['E-' + item['localid']] = item
        }
    }

    return elements
}

function extractConnectors(xmlDoc, tag, tvmap) {
    var xmlelements = xmlDoc.getElementsByTagName(tag)
    var connectors = {}

    for (var i = 0; i < xmlelements.length; i++) {
        var xmlelement = xmlelements[i];

        // extract basic information
        let item = {}
        item['name'] = xmlelement.getAttribute('name')
        item['id'] = xmlelement.getAttribute('xmi.id')

        // tvmap is a dictionary of tagged values to extract. Key=tag, value:name of the key to be added to the item
        for (var tag in tvmap) {
            item[tvmap[tag]] = extractTaggedValue(xmlelement, tag);
        }

        // add the information to the classes dictionary
        let id = item['id']
        connectors[id] = item
        localidmap['C-' + item['localid']] = item
    }

    return connectors
}

function extractDiagramElements(xmldiagram, tag) {
    var xmldiagramElements = xmldiagram.getElementsByTagName(tag)
    var diagramElements = {}

    for (var i = 0; i < xmldiagramElements.length; i++) {
        var xmldiagramElement = xmldiagramElements[i];

        if (xmldiagramElement.getAttribute('subject') != null) {
            // extract basic information
            let item = {}
            item['geometry'] = xmldiagramElement.getAttribute('geometry')
            item['subject'] = xmldiagramElement.getAttribute('subject')
            item['seqno'] = xmldiagramElement.getAttribute('seqno')

            // determine if it's a connector reference or an element reference
            if (allElements[item['subject']] != null) {
                item['type'] = 'element'
            } else if (allConnectors[item['subject']] != null) {
                item['type'] = 'connector'
            } else {
                item['type'] = 'unknown'
            }

            // add the information to the classes dictionary
            let id = item['subject']
            diagramElements[id] = item
        }
    }

    return diagramElements
}

function extractDiagrams(xmlDoc, tag, tvmap) {
    var xmldiagrams = xmlDoc.getElementsByTagName(tag)
    var diagrams = {}

    for (var i = 0; i < xmldiagrams.length; i++) {
        var xmldiagram = xmldiagrams[i];
        // extract basic information
        let item = {}
        item['name'] = xmldiagram.getAttribute('name')
        item['id'] = xmldiagram.getAttribute('xmi.id')
        item['type'] = xmldiagram.getAttribute('diagramType')
        item['owner'] = xmldiagram.getAttribute('owner')

        // tvmap is a dictionary of tagged values to extract. Key=tag, value:name of the key to be added to the item
        for (var tag in tvmap) {
            item[tvmap[tag]] = extractTaggedValue(xmldiagram, tag);
        }

        // extract the diagram elements and connectors
        de = extractDiagramElements(xmldiagram, 'UML:DiagramElement')
        item['diagramelements'] = de

        // add the information to the classes dictionary
        let id = item['id']
        diagrams[id] = item
    }

    return diagrams
}

function extractFromSparxXmlDoc(xmlDoc) {
    var packages = extractElements(xmlDoc, 'UML:Package', {'parent': 'parentid'})
    console.log("Imported " + Object.keys(packages).length + " packages")
    for (var key in packages) {
        console.log(" > Package: " + packages[key]['name'])
    }
    allPackages = packages

    classes = extractElements(xmlDoc, 'UML:Class', {'ea_localid': 'localid', 'owner': 'owner', 'ea_stype': 'type', 'package': 'packageid'})
    console.log("Imported " + Object.keys(classes).length + " classes")
    for (var key in classes) {
        console.log(" > Class: " + classes[key]['name'])
        allElements[key] = classes[key]
    }

    components = extractElements(xmlDoc, 'UML:Component', {'ea_localid': 'localid', 'ea_stype': 'type', 'package': 'packageid'})
    console.log("Imported " + Object.keys(components).length + " components")
    for (var key in components) {
        console.log(" > Component: " + components[key]['name'])
        allElements[key] = components[key]
    }

    actors = extractElements(xmlDoc, 'UML:Actor', {'ea_localid': 'localid', 'owner': 'owner', 'ea_stype': 'type', 'package': 'packageid'})
    console.log("Imported " + Object.keys(actors).length + " actors")
    for (var key in actors) {
        console.log(" > Actor: " + actors[key]['name'])
        allElements[key] = actors[key]
    }

    associations = extractConnectors(xmlDoc, 'UML:Association', {'ea_localid': 'localid', 'ea_stype': 'type', 'direction': 'direction', 'ea_sourceID': 'startid', 'ea_targetID': 'endid', 'ea_sourceType': 'starttype', 'ea_targetType': 'endtype', 'ea_sourceName': 'startname', 'ea_targetName': 'endname'})
    console.log("Imported " + Object.keys(associations).length + " associations")
    for (var key in associations) {
        console.log(" > Connector: " + localidmap['E-'+associations[key]['startid']]['name'] + " -> " + localidmap['E-'+associations[key]['endid']]['name'])
        allConnectors[key] = associations[key]
    }

    diagrams = extractDiagrams(xmlDoc, 'UML:Diagram', {'ea_localid': 'localid', 'type': 'type2' })
    console.log("Imported " + Object.keys(diagrams).length + " diagrams")
    for (var key in diagrams) {
        console.log(" > Diagram: " + diagrams[key]['name'])
        for (var key2 in diagrams[key]['diagramelements']) {
            if (diagrams[key]['diagramelements'][key2]['type'] == 'element') {
                console.log("   > Diagram Element: " + allElements[diagrams[key]['diagramelements'][key2]['subject']]['name'])
                if (allElements[diagrams[key]['diagramelements'][key2]['subject']]['type'] == 'Port') {
                    let owner = allElements[diagrams[key]['diagramelements'][key2]['subject']]['owner']
                    console.log("       > Belongs to: " + allElements[owner]['name'])
                }
            } else if (diagrams[key]['diagramelements'][key2]['type'] == 'connector') {
                console.log("   > Diagram Connector: " + allConnectors[diagrams[key]['diagramelements'][key2]['subject']]['name'])
            } else {
                console.log("   > unknown")
            }
        }
    }
    allDiagrams = diagrams
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

    // <views>
    let views = doc.createElement('views');
    model.appendChild(views);

    // <views>
    //   <diagrams>
    let diagrams = doc.createElement('diagrams');
    views.appendChild(diagrams);

    // add all diagrams
    allDiagrams.forEach(diagram => {
        //   <diagrams>
        //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
        let view = doc.createElement('view');
        view.setAttribute('identifier', diagram.id);
        view.setAttribute('xsi:type', 'Diagram');
        view.setAttribute('viewpoint', 'ArchiMate Diagram');

        //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
        //        <name xml:lang="de">Prova1</name>
        let viewname = doc.createElement('name');
        viewname.setAttribute('xml:lang', 'de');
        viewname.textContent = 'Prova1';
        view.appendChild(viewname);

        element['diagramelements'].forEach(diagramelement => {
            let element = allElements[diagramelement.subject];
            //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
            //        <node identifier="EAID_94620B68_C54A_435d_899D_652653D6D95F" xsi:type="Container" x="0" y="40" w="220" h="50">
            //          <label xml:lang="de">Actor1</label>
            //        </node>
            let node = doc.createElement('node');
            node.setAttribute('identifier', diagramelement.subject);
            node.setAttribute('xsi:type', 'Container');
            let geometry = diagramelement.geometry.split(';');  // Left=351;Top=197;Right=366;Bottom=212;
            node.setAttribute('x', geometry[0].split('=')[1]);
            node.setAttribute('y', geometry[1].split('=')[1]);
            node.setAttribute('w', geometry[2].split('=')[1]);
            node.setAttribute('h', geometry[3].split('=')[1]);
            let label = doc.createElement('label');
            label.setAttribute('xml:lang', 'de');
            label.textContent = element.name;
            node.appendChild(label);
        });

        //      <view identifier="ABC-123" xsi:type="Diagram" viewpoint="ArchiMate Diagram">
        //        <connection identifier="EAID_1CF9F3EF_2625_4d19_AC65_BBFE9D37CAAD" xsi:type="Line" source="EAID_94620B68_C54A_435d_899D_652653D6D95F" target="EAID_AB5B300A_4BB6_4def_96B1_BC69E66A68D0">
        //           <sourceAttachment x="220" y="65" />
        //           <targetAttachment x="320" y="65" />
        //        </connection>
        let connection = doc.createElement('connection');
        connection.setAttribute('identifier', 'ABC-123');
        connection.setAttribute('xsi:type', 'Line');
        connection.setAttribute('source', 'ABC-123');
        connection.setAttribute('target', 'ABC-123');
        let sourceAttachment = doc.createElement('sourceAttachment');
        sourceAttachment.setAttribute('x', '220');
        sourceAttachment.setAttribute('y', '65');
        connection.appendChild(sourceAttachment);
        let targetAttachment = doc.createElement('targetAttachment');
        targetAttachment.setAttribute('x', '320');
        targetAttachment.setAttribute('y', '65');
        connection.appendChild(targetAttachment);
    });

    // Serialize XML DOM to string
    let serializer = new XMLSerializer();
    let xmlStr = serializer.serializeToString(doc);
    let xmlPretty = formatXml(xmlStr, "  ");

    return xmlPretty;
}
//#endregion

//#region Input/Output Processing
function processFile(file) {
    // Process the file here
    // For example, let's just read it as text
    var reader = new FileReader();
    reader.onload = function(e) {
        var contents = e.target.result;
        // Process contents here
        // The file contains XML. Import the XML to a DOM and then process it
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(contents, 'text/xml');
        extractFromSparxXmlDoc(xmlDoc);

        // Create a Blob with the processed contents
        var innovatorXmi = exportToInnovator();
        var blob = new Blob([innovatorXmi], {type: 'text/xml'});

        // Create a URL for the Blob
        var url = URL.createObjectURL(blob);

        // Set the href of the download link to the Blob URL and show the link
        var downloadLink = document.getElementById('downloadLink');
        downloadLink.href = url;
        downloadLink.download = 'processed_' + file.name;
        downloadLink.style.display = 'block';
    };
    reader.readAsText(file);
}
//#endregion
