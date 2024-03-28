let allElements = {}
let allConnectors = {}
let localidmap = {}

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

function processContents(xmlDoc) {
    var packages = extractElements(xmlDoc, 'UML:Package', {'parent': 'parentid'})
    console.log("Imported " + Object.keys(packages).length + " packages")
    for (var key in packages) {
        console.log(" > " + packages[key]['name'])
    }

    classes = extractElements(xmlDoc, 'UML:Class', {'ea_localid': 'localid', 'owner': 'owner', 'ea_stype': 'type', 'package': 'packageid'})
    console.log("Imported " + Object.keys(classes).length + " classes")
    for (var key in classes) {
        console.log(" > " + classes[key]['name'])
        allElements[key] = classes[key]
    }

    components = extractElements(xmlDoc, 'UML:Component', {'ea_localid': 'localid', 'ea_stype': 'type', 'package': 'packageid'})
    console.log("Imported " + Object.keys(components).length + " components")
    for (var key in components) {
        console.log(" > " + components[key]['name'])
        allElements[key] = components[key]
    }

    actors = extractElements(xmlDoc, 'UML:Actor', {'ea_localid': 'localid', 'owner': 'owner', 'ea_stype': 'type', 'package': 'packageid'})
    console.log("Imported " + Object.keys(actors).length + " actors")
    for (var key in actors) {
        console.log(" > " + actors[key]['name'])
        allElements[key] = actors[key]
    }

    associations = extractConnectors(xmlDoc, 'UML:Association', {'ea_localid': 'localid', 'ea_stype': 'type', 'direction': 'direction', 'ea_sourceID': 'startid', 'ea_targetID': 'endid', 'ea_sourceType': 'starttype', 'ea_targetType': 'endtype', 'ea_sourceName': 'startname', 'ea_targetName': 'endname'})
    console.log("Imported " + Object.keys(associations).length + " associations")
    for (var key in associations) {
        console.log(" > " + localidmap['E-'+associations[key]['startid']]['name'] + " -> " + localidmap['E-'+associations[key]['endid']]['name'])
        allConnectors[key] = associations[key]
    }

    diagrams = extractDiagrams(xmlDoc, 'UML:Diagram', {'ea_localid': 'localid', 'type': 'type2' })
    console.log("Imported " + Object.keys(diagrams).length + " diagrams")
    for (var key in diagrams) {
        console.log(" > " + diagrams[key]['name'])
        for (var key2 in diagrams[key]['diagramelements']) {
            if (diagrams[key]['diagramelements'][key2]['type'] == 'element') {
                console.log("   > " + allElements[diagrams[key]['diagramelements'][key2]['subject']]['name'])
            } else if (diagrams[key]['diagramelements'][key2]['type'] == 'connector') {
                console.log("   > " + allConnectors[diagrams[key]['diagramelements'][key2]['subject']]['name'])
            } else {
                console.log("   > unknown")
            }
        }
    }
}

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
        var processedContents = processContents(xmlDoc);

        // Create a Blob with the processed contents
        var blob = new Blob([processedContents], {type: 'text/plain'});

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
