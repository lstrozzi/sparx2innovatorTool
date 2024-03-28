elements = {}
connectors = {}
diagrams = {}

function extractTaggedValue(xmlElement, tag) {
    // extract information from the tagged values
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
            elements[item['id']] = item
        }
    }

    return elements
}

function processContents(xmlDoc) {
    var packages = extractElements(xmlDoc, 'UML:Package', {'parent': 'parentid'})
    console.log("Imported " + Object.keys(packages).length + " packages")
    for (var key in packages) {
        console.log(" > " + packages[key]['name'])
    }

    classes = extractElements(xmlDoc, 'UML:Class', {'owner': 'owner', 'ea_stype': 'type', 'package': 'packageid'})
    console.log("Imported " + Object.keys(classes).length + " classes")
    for (var key in classes) {
        console.log(" > " + classes[key]['name'])
    }

    components = extractElements(xmlDoc, 'UML:Component', {'ea_stype': 'type', 'package': 'packageid'})
    console.log("Imported " + Object.keys(components).length + " components")
    for (var key in components) {
        console.log(" > " + components[key]['name'])
    }

    actors = extractElements(xmlDoc, 'UML:Actor', {'owner': 'owner', 'ea_stype': 'type', 'package': 'packageid'})
    console.log("Imported " + Object.keys(actors).length + " actors")
    for (var key in actors) {
        console.log(" > " + actors[key]['name'])
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

